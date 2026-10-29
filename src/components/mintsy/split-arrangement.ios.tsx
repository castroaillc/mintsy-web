import { ArrangementView, Group, Host, RNHostView } from '@expo/ui/swift-ui';
import { arrangementViewStyle, frame, splitArrangementLayoutSize } from '@expo/ui/swift-ui/modifiers';

import type { SplitArrangementProps } from './split-arrangement';

/**
 * React Native panes in a SwiftUI split ArrangementView, which the system arranges for the
 * window and hardware (e.g. iPhone Duo open). iOS 27.1+; check `supportsArrangementView()` first.
 */
export function SplitArrangement({ primary, secondary, primaryWidth, secondaryMinWidth }: SplitArrangementProps) {
  return (
    <Host style={{ flex: 1 }}>
      <ArrangementView modifiers={[arrangementViewStyle('split'), frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        <ArrangementView.Primary>
          <Group modifiers={[splitArrangementLayoutSize(primaryWidth)]}>
            <RNHostView>{primary}</RNHostView>
          </Group>
        </ArrangementView.Primary>
        <ArrangementView.Secondary>
          <Group modifiers={[splitArrangementLayoutSize({ minWidth: secondaryMinWidth })]}>
            <RNHostView>{secondary}</RNHostView>
          </Group>
        </ArrangementView.Secondary>
      </ArrangementView>
    </Host>
  );
}
