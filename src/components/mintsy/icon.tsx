import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { styled } from 'nativewind';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/** SF Symbol (iOS) / Material Symbol (Android, web) pairs used across mintsy. */
const ICONS = {
  play: { ios: 'play.fill', android: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause' },
  profile: { ios: 'person', android: 'person' },
  search: { ios: 'magnifyingglass', android: 'search' },
  plus: { ios: 'plus', android: 'add' },
  check: { ios: 'checkmark', android: 'check' },
  download: { ios: 'arrow.down.to.line', android: 'download' },
  transcript: { ios: 'doc.text', android: 'description' },
  share: { ios: 'square.and.arrow.up', android: 'share' },
  back: { ios: 'chevron.left', android: 'arrow_back_ios_new' },
  collapse: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  captions: { ios: 'captions.bubble', android: 'closed_caption' },
  fullscreen: { ios: 'arrow.up.left.and.arrow.down.right', android: 'fullscreen' },
  back10: { ios: 'gobackward.10', android: 'replay_10' },
  forward10: { ios: 'goforward.10', android: 'forward_10' },
  previous: { ios: 'backward.end.fill', android: 'skip_previous' },
  next: { ios: 'forward.end.fill', android: 'skip_next' },
  bookmark: { ios: 'bookmark', android: 'bookmark' },
  bookmarkFilled: { ios: 'bookmark.fill', android: 'bookmark' },
  arrowDown: { ios: 'arrow.down', android: 'arrow_downward' },
  eye: { ios: 'eye', android: 'visibility' },
  eyeOff: { ios: 'eye.slash', android: 'visibility_off' },
  settings: { ios: 'gearshape', android: 'settings' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  alert: { ios: 'exclamationmark.circle', android: 'error' },
} satisfies Record<string, Extract<SymbolViewProps['name'], object>>;

export type IconName = keyof typeof ICONS;

type IconBaseProps = {
  name: IconName;
  size?: number;
  style?: StyleProp<TextStyle>;
};

/** Takes its tint from the text color in `className` (e.g. `text-brand`). */
function IconBase({ name, size = 20, style }: IconBaseProps) {
  const { color, ...rest } = StyleSheet.flatten(style) ?? {};
  return (
    <SymbolView
      name={ICONS[name]}
      size={size}
      tintColor={color}
      style={[{ width: size, height: size }, rest]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export const Icon = styled(IconBase, { className: 'style' });
