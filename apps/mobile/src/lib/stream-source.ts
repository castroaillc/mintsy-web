import type { Episode } from '@/data/types';

/**
 * Whether this build streams HLS. Off unless EXPO_PUBLIC_HLS_ENABLED is exactly "true", and never on web:
 * expo-video's web player is a plain <video> without hls.js, so most browsers can't play the playlist.
 */
export const HLS_ENABLED = process.env.EXPO_PUBLIC_HLS_ENABLED === 'true' && process.env.EXPO_OS !== 'web';

/**
 * What to stream for an episode: the HLS playlist when there is one, with the MP4 as its fallback; otherwise the
 * MP4. Null when the episode has neither. Downloaded episodes don't come through here; they play their local file.
 */
export function streamSources(episode: Pick<Episode, 'videoUrl' | 'hlsUrl'>, hlsEnabled: boolean = HLS_ENABLED) {
  const hls = hlsEnabled ? episode.hlsUrl : null;
  if (hls) return { source: hls, fallback: episode.videoUrl };
  return episode.videoUrl ? { source: episode.videoUrl, fallback: null } : null;
}
