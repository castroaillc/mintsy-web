import { router } from 'expo-router';
import { Pressable, ScrollView } from 'react-native';

import { Avatar } from '@/components/mintsy/avatar';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { IconButton } from '@/components/mintsy/icon-button';
import { ProgressBar } from '@/components/mintsy/progress-bar';
import { ScreenHeader } from '@/components/mintsy/screen-header';
import { SafeAreaView } from '@/components/safe-area-view';
import { SettingsLinkRow } from '@/components/settings/settings-rows';
import { SettingsSection } from '@/components/settings/settings-section';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { goalLabel } from '@/data/interests';
import { authClient } from '@/lib/auth-client';
import { useCatalog } from '@/lib/catalog';
import { useOnboarding } from '@/lib/onboarding';
import { usePremium } from '@/lib/premium';
import { useProgress } from '@/lib/progress';
import { episodeLabel, watchedCount } from '@/lib/series';
import { learningStats, weekActivity } from '@/lib/stats';

const CHART_HEIGHT = 76;
/** Bars never scale to less than this, so a single short day doesn't fill the chart. */
const CHART_MIN_SCALE_MINUTES = 15;
/** Empty days still show a stub so the week reads as a chart. */
const BAR_MIN_HEIGHT = 6;

function memberSince(createdAt: Date | string | undefined) {
  if (!createdAt) return undefined;
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function ProfileScreen() {
  const { data: session } = authClient.useSession();
  const { data: onboarding } = useOnboarding();
  const { progress, activity, continueWatching, finishedBooks: finished } = useProgress();
  const catalog = useCatalog();
  const { isPremium } = usePremium();

  const user = session?.user;
  const stats = learningStats(catalog.books, progress, activity);
  const goal = onboarding.dailyGoal;
  const week = weekActivity(activity);
  const metDay = (minutes: number) => (goal ? minutes >= goal : minutes > 0);
  const metGoal = week.filter((d) => metDay(d.minutes)).length;
  // Scale to the busiest day or the goal, whichever is larger; never zero, so empty weeks don't divide by it
  const chartMax = Math.max(CHART_MIN_SCALE_MINUTES, goal, ...week.map((d) => d.minutes));
  const inProgress = continueWatching.map(({ book, episode }) => ({
    book,
    episode,
    fraction: watchedCount(book, progress) / book.episodes.length,
  }));
  const since = memberSince(user?.createdAt);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 pb-10 pt-4">
        <ScreenHeader
          title="Profile"
          backHref="/"
          backLabel="Back to browse"
          action={
            <IconButton
              icon="settings"
              variant="surface"
              accessibilityLabel="Settings"
              onPress={() => router.push('/profile/settings')}
            />
          }
        />

        <HStack className="mt-[22px] items-center gap-4">
          <Avatar name={user?.name} />
          <VStack className="min-w-0 flex-1 gap-1">
            <HStack className="items-center gap-2">
              <Text numberOfLines={1} className="shrink font-inter-semibold text-[20px] text-foreground">
                {user?.name}
              </Text>
              {isPremium ? (
                <Box accessibilityLabel="Premium member" className="h-[22px] justify-center rounded-full bg-brand px-2">
                  <Text className="font-inter-semibold text-[11px] tracking-[0.4px] text-brand-foreground">PREMIUM</Text>
                </Box>
              ) : null}
            </HStack>
            {since ? <Text className="font-inter text-[14px] text-muted-foreground">Member since {since}</Text> : null}
          </VStack>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => router.push('/profile/edit')}
            hitSlop={{ top: 2, bottom: 2 }}
            className="h-10 justify-center rounded-full border border-input px-3.5 active:opacity-70"
          >
            <Text className="font-inter-semibold text-[14px] text-foreground">Edit</Text>
          </Pressable>
        </HStack>

        <HStack accessibilityLabel="Your stats" className="mt-6 gap-2.5">
          <StatTile value={String(stats.streakDays)} label="day streak" />
          <StatTile value={String(stats.episodesWatched)} label="episodes watched" />
          <StatTile value={stats.timeLearning} label="time learning" />
        </HStack>

        <Box className="mt-3.5 rounded-2xl border border-border bg-card p-4">
          <HStack className="items-baseline justify-between">
            <Text accessibilityRole="header" className="font-inter-semibold text-[15px] text-foreground">
              This week
            </Text>
            <Text className="font-inter text-[13px] text-muted-foreground">
              {goal ? `Goal: ${goalLabel(goal)}` : 'No daily goal'}
            </Text>
          </HStack>
          <HStack
            accessible
            accessibilityRole="image"
            accessibilityLabel={`Minutes watched each day this week; ${goal ? 'goal met' : 'watched'} on ${metGoal} of 7 days`}
            className="mt-4 h-24 items-end gap-2.5"
          >
            {week.map((day, i) => {
              const met = metDay(day.minutes);
              const height = Math.max(BAR_MIN_HEIGHT, Math.round((day.minutes / chartMax) * CHART_HEIGHT));
              return (
                <VStack key={i} className="flex-1 items-center gap-1.5">
                  <Box
                    style={{ height }}
                    className={`w-full rounded-md ${met ? 'bg-brand' : day.minutes > 0 ? 'bg-ring' : 'bg-border'}`}
                  />
                  <Text
                    className={`font-inter-medium text-[11px] ${day.isToday ? 'text-foreground' : 'text-faint'}`}
                  >
                    {day.label}
                  </Text>
                </VStack>
              );
            })}
          </HStack>
        </Box>

        {inProgress.length > 0 ? (
          <VStack className="mt-7 gap-3">
            <SectionTitle title="In progress" />
            {inProgress.map(({ book, episode, fraction }) => (
              <Pressable
                key={book.id}
                accessibilityRole="button"
                accessibilityLabel={`${book.title}, ${episodeLabel(episode, book)}, ${Math.round(fraction * 100)}% watched`}
                onPress={() => router.navigate({ pathname: '/book/[id]', params: { id: book.id } })}
                className="flex-row items-center gap-3.5 rounded-[14px] border border-border bg-card p-2.5 active:opacity-80"
              >
                <CoverTile book={book} width={48} />
                <VStack className="min-w-0 flex-1 gap-1.5">
                  <Text numberOfLines={1} className="font-inter-semibold text-[15px] text-foreground">
                    {book.title}
                  </Text>
                  <Text className="font-inter text-[13px] text-muted-foreground">
                    {episodeLabel(episode, book)} · {Math.round(fraction * 100)}%
                  </Text>
                  <ProgressBar value={fraction} rounded />
                </VStack>
              </Pressable>
            ))}
          </VStack>
        ) : null}

        <VStack className="mt-7 gap-3">
          <SectionTitle title="Your interests" actionLabel="Edit" onAction={() => router.push('/profile/edit')} />
          {onboarding.interests.length > 0 ? (
            <HStack className="flex-wrap gap-2">
              {onboarding.interests.map((interest) => (
                <Box key={interest} className="h-[34px] justify-center rounded-full bg-tag px-3.5">
                  <Text className="font-inter text-[14px] text-secondary-foreground">{interest}</Text>
                </Box>
              ))}
            </HStack>
          ) : (
            <Text className="font-inter text-[14px] text-muted-foreground">
              Pick a few topics to get better suggestions.
            </Text>
          )}
        </VStack>

        <Box className="mt-7">
          <SettingsSection>
            <SettingsLinkRow role="link" label="My List" onPress={() => router.navigate('/my-list')} />
            <SettingsLinkRow
              role="link"
              label="Downloads"
              value="No episodes"
              onPress={() => router.navigate('/profile/downloads')}
            />
            <SettingsLinkRow
              role="link"
              label="Finished"
              value={`${finished.length} series`}
              onPress={() => router.push('/profile/finished')}
            />
            <SettingsLinkRow role="link" label="Settings" onPress={() => router.push('/profile/settings')} />
          </SettingsSection>
        </Box>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <VStack accessible accessibilityLabel={`${value} ${label}`} className="flex-1 gap-1 rounded-[14px] border border-border bg-card px-3 py-3.5">
      <Text className="font-display text-[24px] text-foreground">{value}</Text>
      <Text className="font-inter text-[12px] text-muted-foreground">{label}</Text>
    </VStack>
  );
}

type SectionTitleProps = { title: string; actionLabel?: string; onAction?: () => void };

function SectionTitle({ title, actionLabel, onAction }: SectionTitleProps) {
  return (
    <HStack className="items-center justify-between">
      <Text accessibilityRole="header" className="font-display text-[19px] text-foreground">
        {title}
      </Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${actionLabel} ${title.toLowerCase()}`} onPress={onAction} className="min-h-11 justify-center pl-4">
          <Text className="font-inter text-[14px] text-brand">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </HStack>
  );
}
