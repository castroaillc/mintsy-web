import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { EpisodeThumb } from '@/components/mintsy/episode-thumb';
import { Icon } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { ProgressBar } from '@/components/mintsy/progress-bar';
import { ScreenHeader } from '@/components/mintsy/screen-header';
import { SafeAreaView } from '@/components/safe-area-view';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { formatBytes, useDownloads, type ActiveDownload, type DownloadRecord } from '@/lib/downloads';
import { usePreferences } from '@/lib/preferences';
import { openPaywall, usePremium } from '@/lib/premium';

/** Lists stay a comfortable width on wide windows (iPhone Duo open). */
const LIST_MAX_WIDTH = 720;

/**
 * Downloads (not designed; follows Browse and Settings). Premium only: free users get the upgrade, and after
 * Premium lapses the files stay on the device but won't play until it's renewed (or they're deleted).
 */
export default function DownloadsScreen() {
  const { isPremium } = usePremium();
  const downloads = useDownloads();
  const prefs = usePreferences();
  const { items, active } = downloads;
  const lapsed = !isPremium && items.length > 0;

  function confirmDeleteAll() {
    Alert.alert(
      'Delete all downloads?',
      `This frees up ${formatBytes(downloads.totalBytes)} on this device. You can download episodes again any time with Premium.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete all', style: 'destructive', onPress: downloads.removeAll },
      ],
    );
  }

  const play = (record: DownloadRecord) =>
    isPremium
      ? router.push({ pathname: '/player/[episodeId]', params: { episodeId: record.episodeId } })
      : openPaywall(record.episodeId);

  if (!isPremium && items.length === 0) {
    return (
      <EmptyState
        title="Downloads are part of Premium"
        body="Save episodes for flights and commutes with mintsy Premium."
        action={<BrandButton label="Unlock with Premium" onPress={() => openPaywall()} className="mt-2 self-stretch" />}
      />
    );
  }

  if (items.length === 0 && active.length === 0) {
    return (
      <EmptyState
        title="No downloads yet"
        body="Tap Download on a series page to save its next episode. Downloads play here even when you’re offline."
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="px-5 pb-10 pt-5"
        contentContainerStyle={{ maxWidth: LIST_MAX_WIDTH + 40, width: '100%', alignSelf: 'center' }}
      >
        <ScreenHeader title="Downloads" />
        <Text className="mt-1 font-inter text-[14px] text-muted-foreground">
          {items.length} episode{items.length === 1 ? '' : 's'} · {formatBytes(downloads.totalBytes)} on this device
        </Text>

        {lapsed ? (
          <VStack className="mt-5 gap-3 rounded-2xl border border-border bg-card p-4">
            <HStack className="items-start gap-2.5">
              <Icon name="lock" size={18} className="mt-px text-brand" />
              <Text className="flex-1 font-inter-semibold text-[15px] leading-[21px] text-foreground">
                Your Premium has ended
              </Text>
            </HStack>
            <Text className="font-inter text-[14px] leading-[21px] text-muted-foreground">
              Your downloads are still on this device, but they need Premium to play. Renew to watch them, or delete them to
              free up space.
            </Text>
            <HStack className="gap-2.5">
              <BrandButton label="Renew Premium" height={44} onPress={() => openPaywall()} className="flex-1" />
              <BrandButton label="Delete all" variant="outline" height={44} onPress={confirmDeleteAll} className="flex-1" />
            </HStack>
          </VStack>
        ) : null}

        <VStack className="mt-[26px] gap-[26px]">
          {active.length > 0 ? (
            <Section title="Downloading">
              {active.map((a, i) => (
                <ActiveRow key={a.episodeId} download={a} queued={i > 0} onCancel={() => downloads.cancel(a.episodeId)} />
              ))}
            </Section>
          ) : null}

          {items.length > 0 ? (
            <Section title="On this device">
              {items.map((record) => (
                <DownloadRow
                  key={record.episodeId}
                  record={record}
                  thumbnailUrl={downloads.getLocal(record.episodeId)?.episode.thumbnailUrl ?? null}
                  locked={!isPremium}
                  onPress={() => play(record)}
                  onDelete={() => downloads.remove(record.episodeId)}
                />
              ))}
            </Section>
          ) : null}
        </VStack>

        {isPremium ? (
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/profile/settings')}
            className="mt-5 flex-row items-center justify-between gap-3 px-1 py-2 active:opacity-70"
          >
            <Text className="flex-1 font-inter text-[13px] leading-[19px] text-faint">
              {prefs.downloadOnWifiOnly ? 'Downloading on Wi-Fi only.' : 'Downloading on Wi-Fi and mobile data.'} Change in
              Settings.
            </Text>
          </Pressable>
        ) : null}

        {isPremium && items.length > 1 ? (
          <Pressable accessibilityRole="button" onPress={confirmDeleteAll} className="mt-2 h-11 items-center justify-center">
            <Text className="font-inter text-[14px] text-muted-foreground underline">Delete all downloads</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <VStack className="flex-1 px-5 pt-5">
        <ScreenHeader title="Downloads" />
        <Center className="flex-1 gap-3 self-center px-6" style={{ maxWidth: 480 }}>
          <Center className="h-16 w-16 rounded-full bg-tag">
            <Icon name="download" size={26} className="text-brand" />
          </Center>
          <Text className="text-center font-display text-[18px] text-foreground">{title}</Text>
          <Text className="text-center font-inter text-[14px] leading-[21px] text-muted-foreground">{body}</Text>
          {action}
        </Center>
      </VStack>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack className="gap-2.5">
      <Text accessibilityRole="header" className="ml-1 font-inter-semibold text-[13px] uppercase tracking-[1px] text-muted-foreground">
        {title}
      </Text>
      <VStack className="gap-2.5">{children}</VStack>
    </VStack>
  );
}

function ActiveRow({ download, queued, onCancel }: { download: ActiveDownload; queued: boolean; onCancel: () => void }) {
  const pct = download.fraction !== null ? Math.round(download.fraction * 100) : null;
  const status = queued
    ? 'Waiting'
    : pct !== null
      ? `${pct}% · ${formatBytes(download.bytesWritten)}`
      : download.bytesWritten > 0
        ? formatBytes(download.bytesWritten)
        : 'Starting…';
  return (
    <HStack className="items-center gap-3 rounded-[14px] border border-border bg-card py-3 pl-4 pr-1.5">
      <VStack className="min-w-0 flex-1 gap-2">
        <Text numberOfLines={1} className="font-inter-semibold text-[15px] text-foreground">
          {download.title}
        </Text>
        <ProgressBar value={download.fraction ?? 0} height={4} rounded />
        <Text className="font-inter text-[12px] text-muted-foreground tabular-nums">{status}</Text>
      </VStack>
      <IconButton
        icon="close"
        variant="ghost"
        iconSize={16}
        accessibilityLabel={`Cancel downloading ${download.title}`}
        onPress={onCancel}
      />
    </HStack>
  );
}

type DownloadRowProps = {
  record: DownloadRecord;
  thumbnailUrl: string | null;
  locked: boolean;
  onPress: () => void;
  onDelete: () => void;
};

function DownloadRow({ record, thumbnailUrl, locked, onPress, onDelete }: DownloadRowProps) {
  const { book, episode } = record;
  return (
    <HStack className="items-center rounded-[14px] border border-border bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${locked ? 'Needs Premium, ' : ''}${book.title}, Episode ${episode.number}: ${episode.title}`}
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-3.5 p-3 active:opacity-80"
      >
        <EpisodeThumb episode={{ ...episode, thumbnailUrl }} size="sm" locked={locked} />
        <VStack className="min-w-0 flex-1 gap-[3px]">
          <Text numberOfLines={1} className="font-inter-semibold text-[12px] text-muted-foreground">
            {book.title} · Episode {episode.number}
          </Text>
          <Text numberOfLines={2} className="font-inter-semibold text-[15px] leading-[19px] text-foreground">
            {episode.title}
          </Text>
          <Text className="font-inter text-[13px] text-muted-foreground">{formatBytes(record.bytes)}</Text>
        </VStack>
      </Pressable>
      <IconButton
        icon="trash"
        variant="ghost"
        iconSize={17}
        accessibilityLabel={`Delete download of ${episode.title}`}
        onPress={onDelete}
        className="mr-1.5"
      />
    </HStack>
  );
}
