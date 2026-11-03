import { styled } from 'nativewind';
import { ActivityIndicator, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

function SpinnerBase({ style }: { style?: StyleProp<TextStyle> }) {
  const { color } = StyleSheet.flatten(style) ?? {};
  return <ActivityIndicator color={color} />;
}

/** ActivityIndicator that takes its color from a text class (e.g. `text-brand-foreground`). */
export const Spinner = styled(SpinnerBase, { className: 'style' });
