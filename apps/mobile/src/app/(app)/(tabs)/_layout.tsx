import { NativeTabs } from 'expo-router/native-tabs';
import { styled } from 'nativewind';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { useWideLayout } from '@/hooks/use-wide-layout';

function TintedTabsBase({ style, children }: { style?: StyleProp<TextStyle>; children: ReactNode }) {
  const { wide, landscape } = useWideLayout();
  return (
    <NativeTabs
      tintColor={StyleSheet.flatten(style)?.color}
      // Open display in landscape (iPhone Duo): tabs move into the sidebar. Unset elsewhere so phones keep the tab bar.
      preferredPlacement={wide && landscape ? 'sidebar' : undefined}
    >
      {children}
    </NativeTabs>
  );
}

/** NativeTabs whose selected color comes from a theme class, so it follows light/dark mode. */
const TintedTabs = styled(TintedTabsBase, { className: 'style' });

export default function AppTabs() {
  return (
    <TintedTabs className="text-brand">
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="my-list">
        <NativeTabs.Trigger.Label>My List</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} md="bookmark" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
      </NativeTabs.Trigger>
    </TintedTabs>
  );
}
