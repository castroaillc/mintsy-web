import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Book, Episode, EpisodeProgress, ProgressMap } from '@/data/types';
import { useOnline } from '@/hooks/use-online';
import { authClient } from '@/lib/auth-client';
import { useCatalog } from '@/lib/catalog';
import { graphql, GraphQLRequestError } from '@/lib/graphql';
import { continueEpisode, isBookFinished } from '@/lib/series';
import { readUserJson, writeUserJson } from '@/lib/user-files';

/** Seconds of episode watched per local calendar day, keyed `YYYY-MM-DD`. */
export type WatchActivity = Record<string, number>;

/**
 * Largest forward step between two position updates that still counts as watching. The player reports
 * whole seconds, so normal playback moves 1–2s per update (up to 2× speed); anything bigger is a seek.
 */
const MAX_WATCH_STEP_SEC = 3;

/** While playing, positions go to the API this often; pause, seek, end, exit and backgrounding send at once. */
const SEND_INTERVAL_MS = 10_000;

/** Position updates arrive every second while playing; the cache file is rewritten at most this often. */
const WRITE_DELAY_MS = 3000;

/** The API's maximum for `continueWatching(limit)`. */
const CONTINUE_LIMIT = 50;

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

// ── API ─────────────────────────────────────────────────────────────

/** `EpisodeProgress` as the API returns it (without the nested episode and book: the catalog has those). */
type ApiProgress = {
  episodeId: string;
  bookId: string;
  episodeNumber: number;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: string;
};

const PROGRESS_FIELDS = 'episodeId bookId episodeNumber positionSec durationSec completed updatedAt';
const SUMMARY_QUERY = `#graphql
  query MeProgressSummary($limit: Int) {
    me { continueWatching(limit: $limit) { ${PROGRESS_FIELDS} } finishedBookIds }
  }
`;
const BOOK_PROGRESS_QUERY = `#graphql
  query MeBookProgress($bookId: ID!) { me { progress(bookId: $bookId) { ${PROGRESS_FIELDS} } } }
`;
const SET_PROGRESS_MUTATION = `#graphql
  mutation SetProgress($episodeId: ID!, $positionSec: Int!, $completed: Boolean) {
    setProgress(episodeId: $episodeId, positionSec: $positionSec, completed: $completed) { ${PROGRESS_FIELDS} }
  }
`;

/** `progress(bookId)` for several books in one request, aliased b0, b1, … */
function booksProgressQuery(count: number) {
  const indexes = Array.from({ length: count }, (_, i) => i);
  const vars = indexes.map((i) => `$b${i}: ID!`).join(', ');
  const fields = indexes.map((i) => `b${i}: progress(bookId: $b${i}) { ${PROGRESS_FIELDS} }`).join(' ');
  return `query MeBooksProgress(${vars}) { me { ${fields} } }`;
}

function toEntry(p: ApiProgress): EpisodeProgress {
  return { positionSec: p.positionSec, completed: p.completed, updatedAt: p.updatedAt };
}

/** The API refused this save for good (unknown or unpublished episode, Premium required): don't retry it. */
function isRejected(err: unknown) {
  return err instanceof GraphQLRequestError && (err.code === 'BAD_USER_INPUT' || err.code === 'FORBIDDEN');
}

/** `<bookId>-<number>` → bookId */
function bookIdOf(episodeId: string) {
  return /^(.+)-\d+$/.exec(episodeId)?.[1] ?? episodeId;
}

function without<T>(record: Record<string, T>, key: string) {
  const { [key]: _removed, ...rest } = record;
  return rest;
}

// ── Per-user store ──────────────────────────────────────────────────

/** A position not confirmed by the API yet. `completed` undefined keeps the stored value. */
type PendingSave = { positionSec: number; completed?: boolean };

/** A cached `continueWatching` entry. */
type ContinueEntry = { episodeId: string; bookId: string; positionSec: number; completed: boolean };

/** `users/<id>/progress.json`: the last server state plus everything not sent yet, so the app works offline. */
type ProgressFile = {
  version?: number;
  progress: ProgressMap;
  /** Seconds watched per day; device only (the API has no activity yet). */
  activity: WatchActivity;
  /** Saves made offline (or not sent before the app closed): the latest one per episode. */
  queue: Record<string, PendingSave>;
  continueWatching: ContinueEntry[];
  finishedBookIds: string[];
  /** True once the API's progress has loaded at least once for this user. */
  synced: boolean;
  /** Progress from app versions that kept it on the device only; uploaded where the API has none. */
  legacy?: ProgressMap;
};

const FILE = 'progress';
const FILE_VERSION = 2;
const EMPTY_FILE: ProgressFile = { progress: {}, activity: {}, queue: {}, continueWatching: [], finishedBookIds: [], synced: false };

function readFile(userId: string): ProgressFile {
  const file = readUserJson(userId, FILE, EMPTY_FILE);
  if (file.version === FILE_VERSION) return file;
  // Written before progress synced: keep showing it, and upload it once the API's copy has loaded
  const legacy = Object.keys(file.progress).length > 0 ? file.progress : undefined;
  return { ...EMPTY_FILE, progress: file.progress, activity: file.activity, legacy };
}

type Snapshot = {
  progress: ProgressMap;
  activity: WatchActivity;
  continueWatching: ContinueEntry[];
  finishedBookIds: string[];
  /** bookId → when it last changed on this device and the API's lists may not reflect it yet (ms epoch). */
  touched: Record<string, number>;
};

const EMPTY_SNAPSHOT: Snapshot = { progress: {}, activity: {}, continueWatching: [], finishedBookIds: [], touched: {} };

/**
 * One signed-in user's watch progress: the API's copy (`continueWatching`, `progress(bookId)`, `finishedBookIds`),
 * local changes on top of it right away, and `setProgress` saves sent every SEND_INTERVAL_MS or on demand.
 * Saves that can't be sent (offline) wait in the cache file and go out when the connection is back.
 */
class ProgressStore {
  private file: ProgressFile;
  private touched: Record<string, number> = {};
  /** episodeId → when it last changed on this device (ms epoch); server answers older than that don't overwrite it. */
  private changedAt: Record<string, number> = {};
  private inflight = new Set<string>();
  private sending = false;
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private discarded = false;
  private online = true;
  private listeners = new Set<() => void>();
  private snap: Snapshot;

  constructor(readonly userId: string) {
    this.file = readFile(userId);
    this.snap = this.buildSnapshot();
  }

  // ── React (useSyncExternalStore) ──

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snap;

  private buildSnapshot(): Snapshot {
    const { progress, activity, continueWatching, finishedBookIds, synced } = this.file;
    // Never loaded from the API (older backend, or offline since updating): every book reads from the device
    const touched = synced ? this.touched : this.touchedFromDevice();
    return { progress, activity, continueWatching, finishedBookIds, touched };
  }

  private touchedFromDevice() {
    const touched: Record<string, number> = {};
    for (const [episodeId, entry] of Object.entries(this.file.progress)) {
      const bookId = bookIdOf(episodeId);
      touched[bookId] = Math.max(touched[bookId] ?? 0, entry.updatedAt ? Date.parse(entry.updatedAt) : 0);
    }
    return touched;
  }

  private changed() {
    this.snap = this.buildSnapshot();
    this.listeners.forEach((l) => l());
    if (this.closed) this.persist();
    else if (!this.writeTimer) this.writeTimer = setTimeout(() => this.persist(), WRITE_DELAY_MS);
  }

  persist() {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = null;
    if (!this.discarded) writeUserJson(this.userId, FILE, { ...this.file, version: FILE_VERSION });
  }

  // ── Lifecycle ──

  /** Sends anything waiting from last time, then loads the API's copy. */
  start() {
    this.closed = false;
    this.sync();
  }

  /** Signed out or switched accounts: stop, and keep unsent saves in the file for this user's next sign-in. */
  close() {
    this.closed = true;
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.sendTimer = null;
    this.persist();
  }

  /** Account deleted: stop without writing anything again. */
  discard() {
    this.discarded = true;
    this.close();
  }

  setOnline(online: boolean) {
    const reconnected = online && !this.online;
    this.online = online;
    if (reconnected) this.sync();
  }

  // ── Local changes ──

  private queueSave(episodeId: string, save: PendingSave) {
    const now = Date.now();
    this.file.queue = { ...this.file.queue, [episodeId]: save };
    this.changedAt[episodeId] = now;
    this.touched = { ...this.touched, [bookIdOf(episodeId)]: now };
  }

  setPosition(episodeId: string, positionSec: number, saveNow = false) {
    if (this.closed) return;
    const current = this.file.progress[episodeId];
    if (current?.positionSec !== positionSec) {
      const progress = {
        ...this.file.progress,
        [episodeId]: { positionSec, completed: current?.completed ?? false, updatedAt: new Date().toISOString() },
      };
      // Only small forward steps are playback; jumps either way are seeks and don't count as watching
      const step = positionSec - (current?.positionSec ?? 0);
      if (step > 0 && step <= MAX_WATCH_STEP_SEC) {
        const today = dayKey(new Date());
        this.file.activity = { ...this.file.activity, [today]: (this.file.activity[today] ?? 0) + step };
      }
      this.file.progress = progress;
      // A completion waiting to be sent stays part of the save
      this.queueSave(episodeId, { positionSec, completed: this.file.queue[episodeId]?.completed });
      this.changed();
    }
    if (saveNow) this.send();
    else if (!this.sendTimer && this.file.queue[episodeId]) {
      this.sendTimer = setTimeout(() => {
        this.sendTimer = null;
        this.send();
      }, SEND_INTERVAL_MS);
    }
  }

  markCompleted(episodeId: string) {
    if (this.closed) return;
    // Rewatching starts from the top next time
    this.file.progress = {
      ...this.file.progress,
      [episodeId]: { positionSec: 0, completed: true, updatedAt: new Date().toISOString() },
    };
    this.queueSave(episodeId, { positionSec: 0, completed: true });
    this.changed();
    this.send();
  }

  // ── Talking to the API ──

  /** Sends every waiting save, one at a time. Stops at the first failure that isn't the API refusing it (offline). */
  async send() {
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.sendTimer = null;
    if (this.sending || this.closed || !this.online) return;
    this.sending = true;
    const attempted = new Set<PendingSave>();
    try {
      while (!this.closed) {
        const next = Object.entries(this.file.queue).find(([, save]) => !attempted.has(save));
        if (!next) break;
        const [episodeId, save] = next;
        attempted.add(save);
        const startedAt = Date.now();
        this.inflight.add(episodeId);
        try {
          const data = await graphql<{ setProgress: ApiProgress }>(SET_PROGRESS_MUTATION, {
            episodeId,
            positionSec: Math.round(save.positionSec),
            completed: save.completed ?? null,
          });
          this.settle(episodeId, save, startedAt, data.setProgress);
        } catch (err) {
          if (!isRejected(err)) {
            // Offline or the API is having trouble: keep it (and the rest) for later
            console.warn('Progress save failed, will retry', err);
            break;
          }
          console.warn(`Progress save for ${episodeId} refused`, err);
          this.settle(episodeId, save, startedAt, null);
        } finally {
          this.inflight.delete(episodeId);
        }
      }
    } finally {
      this.sending = false;
    }
  }

  /** A save is done (sent, or refused for good): drop it from the queue and take the API's answer if nothing newer happened. */
  private settle(episodeId: string, save: PendingSave, startedAt: number, result: ApiProgress | null) {
    if (this.file.queue[episodeId] === save) this.file.queue = without(this.file.queue, episodeId);
    if (result && !this.closed && (this.changedAt[episodeId] ?? 0) <= startedAt) {
      this.file.progress = { ...this.file.progress, [episodeId]: toEntry(result) };
    }
    this.changed();
  }

  /** True when the device has a change for this episode the API's answer from `since` can't include. */
  private isLocalNewer(episodeId: string, since: number) {
    return (this.changedAt[episodeId] ?? 0) >= since || episodeId in this.file.queue || this.inflight.has(episodeId);
  }

  /** `server` for the episodes `inScope`, except where the device has something newer; other episodes unchanged. */
  private merge(server: ProgressMap, since: number, inScope: (episodeId: string) => boolean) {
    const next: ProgressMap = {};
    for (const [id, entry] of Object.entries(this.file.progress)) {
      if (!inScope(id) || this.isLocalNewer(id, since)) next[id] = entry;
    }
    for (const [id, entry] of Object.entries(server)) {
      if (!(id in next)) next[id] = entry;
    }
    return next;
  }

  /** Sends waiting saves, then reloads everything from the API (sign-in, foreground, back online, leaving the player). */
  async sync() {
    await this.send();
    await this.refresh();
  }

  /** Continue watching, finished series, and the progress of every book in either. Keeps the cache when it fails. */
  async refresh() {
    if (this.closed || !this.online) return;
    const startedAt = Date.now();
    try {
      const summary = await graphql<{ me: { continueWatching: ApiProgress[]; finishedBookIds: string[] } | null }>(
        SUMMARY_QUERY,
        { limit: CONTINUE_LIMIT },
      );
      if (!summary.me || this.closed) return;
      const { continueWatching, finishedBookIds } = summary.me;
      const bookIds = [...new Set([...continueWatching.map((e) => e.bookId), ...finishedBookIds])];
      const perBook = bookIds.length
        ? (
            await graphql<{ me: Record<string, ApiProgress[]> | null }>(
              booksProgressQuery(bookIds.length),
              Object.fromEntries(bookIds.map((id, i) => [`b${i}`, id])),
            )
          ).me
        : {};
      if (!perBook || this.closed) return;

      const server: ProgressMap = {};
      for (const list of Object.values(perBook)) for (const p of list) server[p.episodeId] = toEntry(p);
      this.file.progress = this.merge(server, startedAt, () => true);
      this.file.continueWatching = continueWatching.map(({ episodeId, bookId, positionSec, completed }) => ({
        episodeId,
        bookId,
        positionSec,
        completed,
      }));
      this.file.finishedBookIds = finishedBookIds;
      this.file.synced = true;
      // Books changed since the request started (or with saves still waiting) keep their on-device lists
      const waiting = new Set([...Object.keys(this.file.queue), ...this.inflight].map(bookIdOf));
      this.touched = Object.fromEntries(
        Object.entries(this.touched).filter(([bookId, at]) => at >= startedAt || waiting.has(bookId)),
      );
      this.uploadLegacy(server);
      this.changed();
    } catch (err) {
      console.warn('Failed to load watch progress', err);
    }
  }

  /** One book's progress (the series page), merged like `refresh`. */
  async refreshBook(bookId: string) {
    if (this.closed || !this.online) return;
    const startedAt = Date.now();
    try {
      const data = await graphql<{ me: { progress: ApiProgress[] } | null }>(BOOK_PROGRESS_QUERY, { bookId });
      if (!data.me || this.closed) return;
      const server: ProgressMap = {};
      for (const p of data.me.progress) server[p.episodeId] = toEntry(p);
      this.file.progress = this.merge(server, startedAt, (id) => bookIdOf(id) === bookId);
      this.changed();
    } catch (err) {
      console.warn('Failed to load series progress', err);
    }
  }

  /** Once, after the first load: device-only progress from older app versions goes up where the API has none. */
  private uploadLegacy(server: ProgressMap) {
    const legacy = this.file.legacy;
    if (!legacy) return;
    this.file.legacy = undefined;
    let queued = false;
    for (const [episodeId, entry] of Object.entries(legacy)) {
      if (server[episodeId] || episodeId in this.file.queue) continue;
      if (!entry.completed && entry.positionSec <= 0) continue;
      this.file.progress = { ...this.file.progress, [episodeId]: entry };
      this.queueSave(episodeId, { positionSec: entry.positionSec, completed: entry.completed || undefined });
      queued = true;
    }
    if (queued) this.send();
  }
}

// ── Context ─────────────────────────────────────────────────────────

/** A Continue watching card: the catalog's book and episode, and the viewer's place in it. */
export type ContinueItem = { book: Book; episode: Episode; entry: EpisodeProgress | undefined };

type ProgressContextValue = {
  progress: ProgressMap;
  activity: WatchActivity;
  /** One per book, most recent activity first (the API's `continueWatching`, with this device's changes on top). */
  continueWatching: ContinueItem[];
  /** Series with every episode completed, most recently finished first. */
  finishedBooks: Book[];
  get: (episodeId: string) => EpisodeProgress | undefined;
  /** Updates at once; reaches the API within SEND_INTERVAL_MS, or right away with `saveNow` (seek). */
  setPosition: (episodeId: string, positionSec: number, options?: { saveNow?: boolean }) => void;
  markCompleted: (episodeId: string) => void;
  /** Sends waiting saves now (pause, background). */
  saveNow: () => void;
  /** Sends waiting saves, then reloads from the API (leaving the player, pull to refresh). */
  sync: () => Promise<void>;
  /** Reloads one series' progress from the API. */
  refreshBook: (bookId: string) => Promise<void>;
  /** Account deleted: forget this user's progress on the device without saving again. */
  discardLocal: () => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

const noSubscribe = () => () => {};
const emptySnapshot = () => EMPTY_SNAPSHOT;

/**
 * Watch progress for the signed-in user, stored by the API (`setProgress`, `me.continueWatching`,
 * `me.progress(bookId)`, `me.finishedBookIds`) so it follows them to the web app. Changes show at once and
 * are cached on the device (`users/<id>/progress.json`, see user-files.ts), which also holds saves made
 * offline until they're sent. Seconds watched per day (streaks, the week chart) stay on the device.
 * Signed out there's nothing to track: everything is empty.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id ?? null;
  const catalog = useCatalog();
  const online = useOnline();

  // Another account on this device: switch to its own store (adjusted while rendering, React's pattern for derived state)
  const [store, setStore] = useState(() => (userId ? new ProgressStore(userId) : null));
  if ((store?.userId ?? null) !== userId) setStore(userId ? new ProgressStore(userId) : null);

  const snap = useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getSnapshot ?? emptySnapshot);

  // Sign-in or switching accounts: send what's waiting and load from the API; sign-out keeps unsent saves in the file
  useEffect(() => {
    if (!store) return;
    store.start();
    return () => store.close();
  }, [store]);

  useEffect(() => {
    store?.setOnline(online);
  }, [store, online]);

  // Back in the foreground: reload (progress may have moved on the web). Leaving it: send and write everything now.
  useEffect(() => {
    if (!store) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') store.sync();
      else {
        store.send();
        store.persist();
      }
    });
    return () => sub.remove();
  }, [store]);

  const setPosition = useCallback(
    (episodeId: string, positionSec: number, options?: { saveNow?: boolean }) =>
      store?.setPosition(episodeId, positionSec, options?.saveNow),
    [store],
  );
  const markCompleted = useCallback((episodeId: string) => store?.markCompleted(episodeId), [store]);
  const saveNow = useCallback(() => void store?.send(), [store]);
  const sync = useCallback(async () => store?.sync(), [store]);
  const refreshBook = useCallback(async (bookId: string) => store?.refreshBook(bookId), [store]);
  const discardLocal = useCallback(() => store?.discard(), [store]);

  const value = useMemo<ProgressContextValue>(() => {
    const { progress, touched } = snap;
    // Books changed on this device first (worked out locally, as the API would), then the API's lists
    const recent = Object.keys(touched).sort((a, b) => touched[b] - touched[a]);
    const local = recent.flatMap((bookId) => {
      const book = catalog.getBook(bookId);
      const episode = book && continueEpisode(book, progress);
      return book && episode ? [{ book, episode }] : [];
    });
    const fromApi = snap.continueWatching
      .filter((e) => !(e.bookId in touched))
      .flatMap((e) => {
        const found = catalog.findEpisode(e.episodeId);
        return found ? [{ ...found, fallback: e }] : [];
      });
    const continueWatching: ContinueItem[] = [
      ...local.map(({ book, episode }) => ({ book, episode, entry: progress[episode.id] })),
      ...fromApi.map(({ book, episode, fallback }) => ({ book, episode, entry: progress[episode.id] ?? fallback })),
    ];

    const finishedIds = [
      ...recent.filter((bookId) => {
        const book = catalog.getBook(bookId);
        return !!book && isBookFinished(book, progress);
      }),
      ...snap.finishedBookIds.filter((bookId) => !(bookId in touched)),
    ];
    const finishedBooks = finishedIds.flatMap((bookId) => catalog.getBook(bookId) ?? []);

    return {
      progress,
      activity: snap.activity,
      continueWatching,
      finishedBooks,
      get: (id) => progress[id],
      setPosition,
      markCompleted,
      saveNow,
      sync,
      refreshBook,
      discardLocal,
    };
  }, [snap, catalog, setPosition, markCompleted, saveNow, sync, refreshBook, discardLocal]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
}
