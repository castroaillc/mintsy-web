import { Directory, File, Paths, type DownloadTask } from 'expo-file-system';
import * as Network from 'expo-network';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert } from 'react-native';

import { excludeFromBackup } from '../../modules/backup-exclusion';

import type { Book, Episode } from '@/data/types';
import { authClient } from '@/lib/auth-client';
import { graphql } from '@/lib/graphql';
import { getPreferences } from '@/lib/preferences';
import { openPaywall, usePremium } from '@/lib/premium';

/**
 * Offline downloads (Premium). Each episode lives in `<documents>/downloads/<episodeId>/` as `video.mp4`
 * plus `thumb.jpg`, with everything needed to play it offline (book, episode, transcript, takeaways)
 * in `<documents>/downloads/index.json`. Paths are stored relative because iOS moves the app's
 * container between updates. The folder is durable (not Caches, which iOS purges) but excluded from
 * iCloud backup, as Apple's data storage guidelines require for re-downloadable media.
 */

/** What the index keeps per download. */
export type DownloadRecord = {
  episodeId: string;
  bookId: string;
  /** Book snapshot; its other episodes keep only their list fields (no transcript, takeaways or URLs). */
  book: Book;
  /** Full episode as it was downloaded; `videoUrl` and `thumbnailUrl` are the original remote ones. */
  episode: Episode;
  hasThumbnail: boolean;
  bytes: number;
  /** ISO 8601 */
  downloadedAt: string;
};

type DownloadIndex = {
  version: 1;
  /** Better Auth user the downloads belong to; another account signing in clears them. */
  userId: string | null;
  /** Most recent first. */
  items: DownloadRecord[];
};

export type ActiveDownload = {
  episodeId: string;
  bookId: string;
  title: string;
  /** 0–1, or null while the size is unknown. */
  fraction: number | null;
  bytesWritten: number;
};

export type DownloadStatus = 'none' | 'queued' | 'downloading' | 'downloaded';

// ── Files ───────────────────────────────────────────────────────────

const ROOT = new Directory(Paths.document, 'downloads');
const INDEX_FILE = new File(ROOT, 'index.json');
const EMPTY_INDEX: DownloadIndex = { version: 1, userId: null, items: [] };

/** Episode ids are used as folder names; keep them filesystem-safe. */
const folderName = (episodeId: string) => episodeId.replace(/[^\w.-]/g, '_');
const episodeDir = (episodeId: string) => new Directory(ROOT, folderName(episodeId));
const videoFile = (episodeId: string) => new File(episodeDir(episodeId), 'video.mp4');
const thumbFile = (episodeId: string) => new File(episodeDir(episodeId), 'thumb.jpg');

/** Creates the downloads folder if needed and keeps it (and so everything in it) out of iCloud backup. */
function ensureRoot() {
  ROOT.create({ idempotent: true, intermediates: true });
  excludeFromBackup(ROOT.uri);
}

function readIndex(): DownloadIndex {
  try {
    if (!INDEX_FILE.exists) return EMPTY_INDEX;
    const parsed = JSON.parse(INDEX_FILE.textSync()) as DownloadIndex;
    if (parsed?.version !== 1 || !Array.isArray(parsed.items)) return EMPTY_INDEX;
    // Drop entries whose video went missing (e.g. the OS or a restore removed it)
    return { ...parsed, items: parsed.items.filter((r) => videoFile(r.episodeId).exists) };
  } catch (err) {
    console.warn('Failed to read downloads index', err);
    return EMPTY_INDEX;
  }
}

function writeIndex(index: DownloadIndex) {
  try {
    ensureRoot();
    if (!INDEX_FILE.exists) INDEX_FILE.create();
    INDEX_FILE.write(JSON.stringify(index));
  } catch (err) {
    console.warn('Failed to write downloads index', err);
  }
}

function deleteEpisodeFiles(episodeId: string) {
  try {
    const dir = episodeDir(episodeId);
    if (dir.exists) dir.delete();
  } catch (err) {
    console.warn('Failed to delete download', err);
  }
}

/** Removes folders the index doesn't know (downloads interrupted when the app was killed). */
function removeOrphans(index: DownloadIndex, keep: Set<string>) {
  try {
    if (!ROOT.exists) return;
    const known = new Set([...index.items.map((r) => folderName(r.episodeId)), ...[...keep].map(folderName)]);
    for (const entry of ROOT.list()) {
      if (entry instanceof Directory && !known.has(entry.name)) entry.delete();
    }
  } catch (err) {
    console.warn('Failed to clean up downloads', err);
  }
}

/** The book with only list fields on its episodes; `full` keeps everything for the downloaded one. */
function snapshotBook(book: Book, full: Episode): Book {
  return {
    ...book,
    episodes: book.episodes.map((e) =>
      e.id === full.id ? full : { ...e, transcript: [], takeaways: [], videoUrl: null, thumbnailUrl: null },
    ),
  };
}

// ── API ─────────────────────────────────────────────────────────────

const BOOK_MEDIA_QUERY = `#graphql
  query DownloadBook($id: ID!) {
    book(id: $id) {
      id
      title
      author
      category
      coverTone
      tint
      description
      episodes {
        id
        number
        title
        summary
        durationSec
        transcript { startSec text }
        takeaways
        videoUrl
        thumbnailUrl
        locked
      }
    }
  }
`;

/** The book fresh from the API, so the (signed, ~1 hour) video URL is new when the download starts. */
async function fetchFreshBook(bookId: string) {
  const data = await graphql<{ book: Book | null }>(BOOK_MEDIA_QUERY, { id: bookId });
  return data.book;
}

class DownloadError extends Error {}

/** Resolves true when downloading now is allowed by the connection and the Wi-Fi-only setting. */
async function checkConnection(): Promise<boolean> {
  let state: Network.NetworkState;
  try {
    state = await Network.getNetworkStateAsync();
  } catch {
    // Unknown: let the download try
    return true;
  }
  if (state.isConnected === false || state.isInternetReachable === false) {
    Alert.alert('You’re offline', 'Connect to the internet to download episodes.');
    return false;
  }
  const onWifi = state.type === Network.NetworkStateType.WIFI || state.type === Network.NetworkStateType.ETHERNET;
  if (getPreferences().downloadOnWifiOnly && !onWifi) {
    Alert.alert('Waiting for Wi-Fi', 'Downloads are set to use Wi-Fi only. Connect to Wi-Fi, or change this in Settings.', [
      { text: 'OK', style: 'cancel' },
      { text: 'Settings', onPress: () => router.push('/profile/settings') },
    ]);
    return false;
  }
  return true;
}

// ── Context ─────────────────────────────────────────────────────────

/** Local copy of a downloaded episode, ready for the player. */
export type LocalEpisode = { book: Book; episode: Episode; videoUri: string };

type DownloadsContextValue = {
  /** Finished downloads, most recent first. */
  items: DownloadRecord[];
  /** Downloads in progress or queued, in start order. */
  active: ActiveDownload[];
  /** Bytes used by finished downloads. */
  totalBytes: number;
  status: (episodeId: string) => DownloadStatus;
  /** Starts downloading (Premium only; checks the connection and Wi-Fi setting first). */
  download: (book: Book, episode: Episode) => Promise<void>;
  cancel: (episodeId: string) => void;
  remove: (episodeId: string) => void;
  /** Cancels everything in progress and deletes every download (sign-out, account deletion, or the user choosing Delete all). A Premium lapse keeps files and only blocks playback. */
  removeAll: () => void;
  /** The downloaded copy, with file URIs swapped in, or null when it isn't downloaded. */
  getLocal: (episodeId: string) => LocalEpisode | null;
};

const DownloadsContext = createContext<DownloadsContextValue | null>(null);

/** Progress updates are throttled to this interval so the UI doesn't re-render on every chunk. */
const PROGRESS_INTERVAL_MS = 250;

type Job = { task: DownloadTask | null; cancelled: boolean; lastUpdate: number };

export function DownloadsProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const { isPremium } = usePremium();
  const [index, setIndex] = useState<DownloadIndex>(readIndex);
  const [active, setActive] = useState<ActiveDownload[]>([]);
  const jobs = useRef(new Map<string, Job>());
  // Downloads run one at a time, in the order they were asked for
  const queue = useRef<Promise<void>>(Promise.resolve());

  const updateIndex = useCallback((update: (prev: DownloadIndex) => DownloadIndex) => {
    setIndex((prev) => {
      const next = update(prev);
      writeIndex(next);
      return next;
    });
  }, []);

  // Clean up folders left by downloads interrupted when the app was killed, and exclude downloads made
  // before the backup exclusion existed (same location, so nothing moves)
  useEffect(() => {
    removeOrphans(index, new Set(jobs.current.keys()));
    if (ROOT.exists) excludeFromBackup(ROOT.uri);
    // Once at launch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeAll = useCallback(() => {
    for (const job of jobs.current.values()) {
      job.cancelled = true;
      job.task?.cancel();
    }
    jobs.current.clear();
    setActive([]);
    try {
      if (ROOT.exists) ROOT.delete();
    } catch (err) {
      console.warn('Failed to delete downloads', err);
    }
    setIndex((prev) => {
      const next = { ...EMPTY_INDEX, userId: prev.userId };
      writeIndex(next);
      return next;
    });
  }, []);

  // Downloads belong to one account: another account signing in on this device starts empty.
  // Adjusted while rendering (React's pattern for state derived from props); the effect below syncs the files.
  if (!isPending && userId && index.userId !== userId) {
    setIndex({ version: 1, userId, items: index.userId ? [] : index.items });
  }
  useEffect(() => {
    if (!index.userId) return;
    writeIndex(index);
    removeOrphans(index, new Set(jobs.current.keys()));
    // Only when the owner changes; other index changes write the file themselves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index.userId]);

  const setProgress = useCallback((episodeId: string, bytesWritten: number, totalBytes: number) => {
    const job = jobs.current.get(episodeId);
    if (!job) return;
    const now = Date.now();
    if (now - job.lastUpdate < PROGRESS_INTERVAL_MS) return;
    job.lastUpdate = now;
    setActive((prev) =>
      prev.map((a) =>
        a.episodeId === episodeId
          ? { ...a, bytesWritten, fraction: totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : null }
          : a,
      ),
    );
  }, []);

  const finishJob = useCallback((episodeId: string) => {
    jobs.current.delete(episodeId);
    setActive((prev) => prev.filter((a) => a.episodeId !== episodeId));
  }, []);

  /** Runs one download; throws DownloadError with a message for the user. */
  const run = useCallback(
    async (bookId: string, episodeId: string, job: Job) => {
      const book = await fetchFreshBook(bookId).catch(() => {
        throw new DownloadError('Check your connection and try again.');
      });
      const episode = book?.episodes.find((e) => e.id === episodeId);
      if (!book || !episode) throw new DownloadError('This episode isn’t available anymore.');
      if (episode.locked) throw new DownloadError('Your Premium access is still syncing. Try again in a moment.');
      if (!episode.videoUrl) throw new DownloadError('This episode’s video isn’t ready yet.');
      if (job.cancelled) return;

      ensureRoot();
      const dir = episodeDir(episodeId);
      if (dir.exists) dir.delete();
      dir.create({ intermediates: true });
      excludeFromBackup(dir.uri);

      if (episode.thumbnailUrl) {
        try {
          await File.downloadFileAsync(episode.thumbnailUrl, thumbFile(episodeId), { idempotent: true });
        } catch {
          // The thumbnail is optional; the tinted tile stands in
        }
      }
      if (job.cancelled) return;

      const task = File.createDownloadTask(episode.videoUrl, videoFile(episodeId), {
        // Typed as numbers, but iOS reports these 64-bit counts as BigInt; mixing them into Math.min crashes the render
        onProgress: ({ bytesWritten, totalBytes }) => setProgress(episodeId, Number(bytesWritten), Number(totalBytes)),
      });
      job.task = task;
      const file = await task.downloadAsync();
      if (job.cancelled || !file?.exists) return;

      const record: DownloadRecord = {
        episodeId,
        bookId,
        book: snapshotBook(book, episode),
        episode,
        hasThumbnail: thumbFile(episodeId).exists,
        bytes: Number(file.size) + (thumbFile(episodeId).exists ? Number(thumbFile(episodeId).size) : 0),
        downloadedAt: new Date().toISOString(),
      };
      updateIndex((prev) => ({ ...prev, items: [record, ...prev.items.filter((r) => r.episodeId !== episodeId)] }));
    },
    [setProgress, updateIndex],
  );

  const download = useCallback(
    async (book: Book, episode: Episode) => {
      if (!isPremium) {
        openPaywall(episode.id);
        return;
      }
      if (jobs.current.has(episode.id) || index.items.some((r) => r.episodeId === episode.id)) return;
      if (!(await checkConnection())) return;

      const job: Job = { task: null, cancelled: false, lastUpdate: 0 };
      jobs.current.set(episode.id, job);
      setActive((prev) => [
        ...prev,
        { episodeId: episode.id, bookId: book.id, title: episode.title, fraction: null, bytesWritten: 0 },
      ]);

      queue.current = queue.current.then(async () => {
        if (job.cancelled) return;
        try {
          await run(book.id, episode.id, job);
        } catch (err) {
          if (!job.cancelled) {
            console.warn('Download failed', err);
            Alert.alert(
              'Download failed',
              err instanceof DownloadError ? err.message : `“${episode.title}” didn’t finish downloading. Try again.`,
            );
          }
          deleteEpisodeFiles(episode.id);
        } finally {
          job.task?.release?.();
          if (job.cancelled) deleteEpisodeFiles(episode.id);
          if (jobs.current.get(episode.id) === job) finishJob(episode.id);
        }
      });
    },
    [isPremium, index.items, run, finishJob],
  );

  const cancel = useCallback(
    (episodeId: string) => {
      const job = jobs.current.get(episodeId);
      if (!job) return;
      job.cancelled = true;
      job.task?.cancel();
      finishJob(episodeId);
    },
    [finishJob],
  );

  const remove = useCallback(
    (episodeId: string) => {
      deleteEpisodeFiles(episodeId);
      updateIndex((prev) => ({ ...prev, items: prev.items.filter((r) => r.episodeId !== episodeId) }));
    },
    [updateIndex],
  );

  const value = useMemo<DownloadsContextValue>(() => {
    const items = index.items;
    return {
      items,
      active,
      totalBytes: items.reduce((sum, r) => sum + r.bytes, 0),
      status: (episodeId) => {
        if (items.some((r) => r.episodeId === episodeId)) return 'downloaded';
        const a = active.find((x) => x.episodeId === episodeId);
        if (!a) return 'none';
        return a === active[0] ? 'downloading' : 'queued';
      },
      download,
      cancel,
      remove,
      removeAll,
      getLocal: (episodeId) => {
        const record = items.find((r) => r.episodeId === episodeId);
        if (!record) return null;
        const thumbnailUrl = record.hasThumbnail ? thumbFile(episodeId).uri : null;
        const videoUri = videoFile(episodeId).uri;
        const episode = { ...record.episode, videoUrl: videoUri, thumbnailUrl, locked: false };
        return {
          book: { ...record.book, episodes: record.book.episodes.map((e) => (e.id === episodeId ? episode : e)) },
          episode,
          videoUri,
        };
      },
    };
  }, [index.items, active, download, cancel, remove, removeAll]);

  return <DownloadsContext.Provider value={value}>{children}</DownloadsContext.Provider>;
}

export function useDownloads() {
  const ctx = useContext(DownloadsContext);
  if (!ctx) throw new Error('useDownloads must be used within DownloadsProvider');
  return ctx;
}

/** 734003200 → "700 MB" */
export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
