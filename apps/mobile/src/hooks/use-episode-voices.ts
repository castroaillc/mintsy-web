import { useEffect, useRef, useState } from 'react';

import type { EpisodeVoice } from '@/data/types';
import { graphql } from '@/lib/graphql';
import { rememberVoices } from '@/lib/preferences';
import { fetchEpisodeVoices } from '@/lib/voices';

/** How long playback may wait for a viewer with a preferred narrator. After this it starts on the catalog's source. */
const START_WAIT_MS = 1500;
/** A slower answer than this counts as failed. Between the two, the picker and captions still arrive, without changing the voice. */
const LOAD_TIMEOUT_MS = 10_000;
/** A refetch happens in front of the viewer (switching voice, a failed URL), so it gets less time. */
const REFETCH_TIMEOUT_MS = 3000;
/** Same as the catalog's staleness rule. URLs can be signed and short-lived, so don't switch to one this old. */
const STALE_AFTER_MS = 5 * 60 * 1000;

/**
 * The player's copy of `episodeVoices`, loaded once per episode. Failure or `[]` leaves `voices` empty, which means
 * "play it as it's always played": nothing is shown, thrown or logged as an error, and nothing else depends on it.
 */
export function useEpisodeVoices(episodeId: string, enabled: boolean) {
  const [voices, setVoices] = useState<EpisodeVoice[]>([]);
  /** The answer arrived or the start wait ran out. */
  const [settled, setSettled] = useState(!enabled);
  const fetchedAt = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    const timer = setTimeout(() => setSettled(true), START_WAIT_MS);
    fetchEpisodeVoices(graphql, episodeId, LOAD_TIMEOUT_MS).then((list) => {
      if (!current) return;
      clearTimeout(timer);
      if (list) {
        fetchedAt.current = Date.now();
        setVoices(list);
        if (list.length > 1) rememberVoices(list);
      }
      setSettled(true);
    });
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [episodeId, enabled]);

  /** Fresh URLs. An empty or failed answer keeps what's there and returns null: the caller carries on without them. */
  const refetch = async () => {
    const list = await fetchEpisodeVoices(graphql, episodeId, REFETCH_TIMEOUT_MS);
    if (!list?.length) return null;
    fetchedAt.current = Date.now();
    setVoices(list);
    return list;
  };

  return {
    voices,
    settled,
    refetch,
    /** Whether URLs should be refreshed before they're used for a new source. */
    isStale: () => Date.now() - fetchedAt.current > STALE_AFTER_MS,
  };
}
