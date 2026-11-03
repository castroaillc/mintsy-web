import { Stack } from 'expo-router';

/** Home tab stack: Browse → Book detail push inside the tab. */
export default function HomeStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
