import { styled } from 'nativewind';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';

/** SafeAreaView with NativeWind `className` support (third-party components aren't mapped automatically). */
export const SafeAreaView = styled(RNSafeAreaView, { className: 'style' });
