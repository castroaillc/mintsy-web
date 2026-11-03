import { NativeTabs } from 'expo-router/native-tabs';
import { styled } from 'nativewind';
import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

function TintedTabsBase({ style, children }: { style?: StyleProp<TextStyle>; children: ReactNode }) {
  return (
    <NativeTabs
      tintColor={StyleSheet.flatten(style)?.color}
      // preferredPlacement stays unset, so iOS keeps the tab bar (in the rail on iPhone Duo open in landscape). Any value,
      // even 'automatic', enables the sidebar mode, whose toggle needs a header, and these screens have none.
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
