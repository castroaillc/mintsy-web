import type { ReactElement } from 'react';
import { View } from 'react-native';

export type SplitArrangementProps = {
  primary: ReactElement;
  secondary: ReactElement;
  primaryWidth: { minWidth: number; idealWidth: number; maxWidth: number };
  secondaryMinWidth: number;
};

/**
 * ArrangementView is iOS-only; elsewhere this is a plain row. Screens only pick the split layout
 * when `supportsArrangementView()` is true, so this is a safety net that keeps Android and web
 * from loading the SwiftUI views.
 */
export function SplitArrangement({ primary, secondary, primaryWidth }: SplitArrangementProps) {
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: primaryWidth.idealWidth }}>{primary}</View>
      <View style={{ flex: 1 }}>{secondary}</View>
    </View>
  );
}
