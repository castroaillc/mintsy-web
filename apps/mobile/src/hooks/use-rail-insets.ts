import { useVerticalBarEdgeIOS } from 'expo-status-bar';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { RAIL_WIDTH, useWideLayout } from '@/hooks/use-wide-layout';

/**
 * Safe-area insets that always clear the system rail. In modals the root provider can report 0 on the rail side while
 * iPhone Duo open and rotated still draws the rail there, so that pose takes the rail's side from the window instead.
 * Every other window gets the plain insets. `left` and `right` in styles swap in RTL, so leading and trailing line up.
 */
export function useRailInsets(): EdgeInsets {
  const insets = useSafeAreaInsets();
  const { shortWide } = useWideLayout();
  const edge = useVerticalBarEdgeIOS();
  if (!shortWide) return insets;
  // Nothing says where the rail is: clear both sides rather than let it cover anything
  const unknown = edge === null && insets.left < RAIL_WIDTH && insets.right < RAIL_WIDTH;
  return {
    ...insets,
    left: edge === 'leading' || unknown ? Math.max(insets.left, RAIL_WIDTH) : insets.left,
    right: edge === 'trailing' || unknown ? Math.max(insets.right, RAIL_WIDTH) : insets.right,
  };
}
