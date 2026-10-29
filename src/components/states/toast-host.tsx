import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { hideToast, useToast } from '@/lib/toast';

/**
 * Renders the current toast at the bottom of the screen it's placed in. Its own SafeAreaProvider measures
 * the insets of the area it covers, so inside a tab it sits above the native tab bar (whose height can't be
 * measured) and on the open iPhone Duo it clears the rail. Place one per tab stack and one per modal.
 */
export function ToastHost() {
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <SafeAreaProvider pointerEvents="box-none" style={{ flex: 1 }}>
        <ToastBody />
      </SafeAreaProvider>
    </View>
  );
}

function ToastBody() {
  const toast = useToast();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (toast) AccessibilityInfo.announceForAccessibility(toast.message);
  }, [toast]);

  if (!toast) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: insets.left + 16, right: insets.right + 16, bottom: insets.bottom + 12, alignItems: 'center' }}
    >
      <Animated.View
        key={toast.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        accessibilityLiveRegion="polite"
        className="min-h-12 w-full max-w-[420px] flex-row items-center gap-3 rounded-[14px] bg-foreground pl-4 pr-1.5"
        style={{ boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)' }}
      >
        <Text className="flex-1 py-3 font-inter-medium text-[14px] text-background">{toast.message}</Text>
        {toast.actionLabel ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.onAction?.();
              hideToast();
            }}
            className="h-11 min-w-11 items-center justify-center px-3 active:opacity-70"
          >
            <Text className="font-inter-semibold text-[14px] text-brand dark:text-[#B8321F]">{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}
