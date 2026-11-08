import type { ReactNode } from 'react';

import { SegmentedControl } from '@/components/settings/segmented-control';
import { SettingsContentRow, SettingsLinkRow, SettingsToggleRow } from '@/components/settings/settings-rows';
import { SettingsSection } from '@/components/settings/settings-section';
import type { ModeType } from '@/components/ui/gluestack-ui-provider';
import { SPEEDS } from '@/hooks/use-playback-clock';
import { openLegalUrl, PRIVACY_URL, SHOW_TERMS, TERMS_LABEL, TERMS_URL } from '@/lib/legal';
import { setPreferences, usePreferences } from '@/lib/preferences';
import { openHelpCenter, sendFeedback } from '@/lib/support';
import { useThemeMode } from '@/lib/theme-mode';

/*
 * Settings kept on the device rather than with the account, so guests have them too (Profile when signed out)
 * as well as Settings.
 */

const THEME_OPTIONS: { label: string; value: ModeType }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

/** Autoplay, speed and captions. `children`: more rows at the end (Settings adds the download ones). */
export function PlaybackSettings({ children }: { children?: ReactNode }) {
  const prefs = usePreferences();

  function cycleSpeed() {
    const i = SPEEDS.indexOf(prefs.defaultSpeed);
    setPreferences({ defaultSpeed: SPEEDS[(i + 1) % SPEEDS.length] });
  }

  return (
    <SettingsSection title="Playback">
      <SettingsToggleRow
        label="Autoplay next episode"
        hint="Keep the series going"
        value={prefs.autoplayNext}
        onChange={(v) => setPreferences({ autoplayNext: v })}
      />
      <SettingsLinkRow label="Default speed" value={`${prefs.defaultSpeed}×`} onPress={cycleSpeed} />
      <SettingsToggleRow
        label="Captions on by default"
        hint="Show captions in the player"
        value={prefs.captionsByDefault}
        onChange={(v) => setPreferences({ captionsByDefault: v })}
      />
      {children}
    </SettingsSection>
  );
}

export function AppearanceSettings() {
  const { mode, setMode } = useThemeMode();
  return (
    <SettingsSection title="Appearance">
      <SettingsContentRow>
        <SegmentedControl accessibilityLabel="Theme" options={THEME_OPTIONS} value={mode} onChange={setMode} />
      </SettingsContentRow>
    </SettingsSection>
  );
}

export function SupportSettings() {
  return (
    <SettingsSection title="Support">
      <SettingsLinkRow role="link" label="Help center" onPress={openHelpCenter} />
      <SettingsLinkRow label="Send feedback" onPress={sendFeedback} />
      {SHOW_TERMS ? <SettingsLinkRow role="link" label={TERMS_LABEL} onPress={() => openLegalUrl(TERMS_URL)} /> : null}
      <SettingsLinkRow role="link" label="Privacy Policy" onPress={() => openLegalUrl(PRIVACY_URL)} />
    </SettingsSection>
  );
}
