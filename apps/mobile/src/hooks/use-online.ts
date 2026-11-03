import { useNetworkState } from 'expo-network';

/**
 * False only when the device is known to be offline. Unknown states (still checking, web) count as online so
 * screens don't flash an offline banner at launch.
 */
export function useOnline() {
  const state = useNetworkState();
  return !(state.isConnected === false || state.isInternetReachable === false);
}
