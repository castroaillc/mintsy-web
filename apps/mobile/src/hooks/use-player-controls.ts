import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

import {
  canAutoHide,
  CONTROLS_AUTO_HIDE_MS,
  CONTROLS_FADE_IN_MS,
  CONTROLS_FADE_OUT_MS,
  isStopped,
  PAUSE_REVEAL_DELAY_MS,
} from '@/lib/player-controls';

export type PlayerControls = {
  visible: boolean;
  /** 1 with the controls up, 0 with them hidden, animated between. Captions follow it too. */
  progress: SharedValue<number>;
  /** A tap on the video. */
  toggle: () => void;
  /** Any touch on the screen: restarts the auto-hide wait, without bringing hidden controls back. */
  touch: () => void;
  setScrubbing: (scrubbing: boolean) => void;
  /** A menu the controls opened, such as the narrator alert, is on screen. */
  setMenuOpen: (open: boolean) => void;
};

/**
 * Whether the player's controls are showing. They start up, fade a few seconds after the last interaction while
 * playing, and come back when playback stops. A stall isn't a stop: the video shows a spinner and stays clear.
 */
export function usePlayerControls({ playing, buffering }: { playing: boolean; buffering: boolean }): PlayerControls {
  const [shown, setShown] = useState(true);
  const [lastTouch, setLastTouch] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [screenReader, setScreenReader] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReader(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const autoHides = canAutoHide({ playing, scrubbing, menuOpen, screenReader });
  useEffect(() => {
    if (!shown || !autoHides) return;
    const timer = setTimeout(() => setShown(false), CONTROLS_AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [shown, autoHides, lastTouch]);

  const stopped = isStopped({ playing, buffering });
  useEffect(() => {
    if (!stopped) return;
    const timer = setTimeout(() => setShown(true), PAUSE_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [stopped]);

  const visible = shown || screenReader;
  const progress = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, { duration: visible ? CONTROLS_FADE_IN_MS : CONTROLS_FADE_OUT_MS });
  }, [visible, progress]);

  return {
    visible,
    progress,
    toggle: () => {
      setLastTouch(Date.now());
      setShown((s) => !s);
    },
    touch: () => setLastTouch(Date.now()),
    setScrubbing,
    setMenuOpen,
  };
}
