import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { ChipRow } from '@/components/mintsy/chip-row';
import { ContinueCard } from '@/components/mintsy/continue-card';
import { CoverTile } from '@/components/mintsy/cover-tile';
import { Icon } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { SectionRow } from '@/components/mintsy/section-row';
import { Wordmark } from '@/components/mintsy/wordmark';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import { useWideLayout } from '@/hooks/use-wide-layout';
import { CATEGORIES, type Book, type CategoryFilter } from '@/data/types';
import { authClient } from '@/lib/auth-client';
import { useCatalog } from '@/lib/catalog';
import { useIsLocked, useOpenEpisode, usePremium } from '@/lib/premium';
import { useProgress } from '@/lib/progress';
import { useSaved } from '@/lib/saved';
import { averageEpisodeMinutes, countLabel, inProgressEpisode } from '@/lib/series';

function matchesQuery(book: Book, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [book.title, book.author, book.category].some((field) => field.toLowerCase().includes(q));
}

function openBook(book: Book) {
  router.push({ pathname: '/book/[id]', params: { id: book.id } });
}

export default function BrowseScreen() {
  const { data: session } = authClient.useSession();
  const { progress } = useProgress();
  const { books, status, retry, retrying } = useCatalog();
  // Re-reads Premium (purchases made elsewhere, renewals, expiry) and then refetches the catalog
  const { refresh } = usePremium();
  // Locked episodes (free tier) open the paywall instead of the player
  const openEpisode = useOpenEpisode();
  const isLocked = useIsLocked();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');
  const { wide } = useWideLayout();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh().finally(() => setRefreshing(false));
  }, [refresh]);

  const visible = books.filter(
    (b) => (category === 'All' || b.category === category) && matchesQuery(b, query),
  );
  // Books arrive sorted by `order`: order 0 (the first playable book) is featured
  const featured = books.find((b) => b.episodes.length > 0);
  const showFeatured = !!featured && visible.includes(featured) && !query.trim();
  const featuredMinutes = featured ? averageEpisodeMinutes(featured) : undefined;
  // New books are appended with the next-highest `order`, so the newest are at the end
  const newest = books.slice(-4).reverse();

  const continueList = visible.flatMap((book) => {
    const episode = inProgressEpisode(book, progress);
    return episode ? [{ book, episode }] : [];
  });

  const topCategory = category === 'All' ? 'Finance' : category;
  // Titles stay factual: there are no rankings or publish dates to back "Top" or "this week" claims
  const rows = [
    { title: `More in ${topCategory}`, books: visible.filter((b) => b.category === topCategory) },
    { title: 'Recently added', books: newest.filter((b) => visible.includes(b)) },
  ].filter((row) => row.books.length > 0);

  const initial = session?.user.name?.trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="pb-8"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <HStack className="items-center justify-between px-5 pb-3 pt-5">
          <Wordmark size={26} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profile"
            onPress={() => router.push('/profile')}
            className="h-11 w-11 items-center justify-center rounded-full border border-input bg-surface-raised active:opacity-70"
          >
            {initial ? (
              <Text className="font-display-medium text-[17px] text-foreground">{initial}</Text>
            ) : (
              <Icon name="profile" size={20} className="text-foreground" />
            )}
          </Pressable>
        </HStack>

        {status === 'error' ? (
          <OfflineNotice retry={retry} retrying={retrying} />
        ) : null}

        <Box className="px-5 pt-1">
          <Input className="h-[50px] gap-2.5 rounded-[14px] border-input bg-surface-raised px-4 dark:bg-surface-raised">
            <InputSlot>
              <Icon name="search" size={20} className="text-faint" />
            </InputSlot>
            <InputField
              value={query}
              onChangeText={setQuery}
              placeholder="Search books, authors, topics"
              accessibilityLabel="Search books"
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              className="font-inter text-[15px] text-foreground placeholder:text-faint"
            />
          </Input>
        </Box>

        <Box className="pt-4">
          <ChipRow options={CATEGORIES} value={category} onChange={setCategory} />
        </Box>

        {showFeatured && featured ? (
          <Box className="px-5 pt-5">
            {/* Wide windows: cover left, text right */}
            <Box
              className={`overflow-hidden rounded-[22px] border border-border bg-surface-raised ${wide ? 'flex-row' : ''}`}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${featured.title}`}
                onPress={() => openBook(featured)}
                style={{ backgroundColor: featured.tint }}
                className={`h-[250px] items-center justify-center ${wide ? 'w-[320px]' : ''}`}
              >
                <CoverTile book={featured} width={132} />
              </Pressable>
              <VStack className={`gap-2.5 px-[18px] pb-5 pt-[18px] ${wide ? 'flex-1 justify-center px-6' : ''}`}>
                <Text className="font-inter-semibold text-[12px] uppercase tracking-[1.2px] text-brand">
                  Featured series
                </Text>
                <Pressable accessibilityRole="link" onPress={() => openBook(featured)}>
                  <Text className="font-display text-[24px] leading-[28px] text-foreground">{featured.title}</Text>
                </Pressable>
                <Text className="font-inter text-[14px] text-muted-foreground">
                  {featured.author} · {countLabel(featured.episodes.length, 'episode')}
                  {featuredMinutes ? ` · ${featuredMinutes} min each` : ''}
                </Text>
                <HStack className="mt-1.5 gap-2.5">
                  <BrandButton
                    label="Play Episode 1"
                    icon="play"
                    onPress={() => openEpisode(featured.episodes[0])}
                    className="flex-1"
                  />
                  <SaveButton bookId={featured.id} title={featured.title} />
                </HStack>
              </VStack>
            </Box>
          </Box>
        ) : null}

        {continueList.length > 0 ? (
          <SectionRow title="Continue watching">
            {continueList.map(({ book, episode }) => (
              <ContinueCard
                key={episode.id}
                book={book}
                episode={episode}
                entry={progress[episode.id]}
                locked={isLocked(episode)}
                onPress={() => openEpisode(episode)}
              />
            ))}
          </SectionRow>
        ) : null}

        {rows.map((row) => (
          <SectionRow
            key={row.title}
            title={row.title}
            actionLabel="See all"
            onAction={() => router.navigate('/search')}
          >
            {row.books.map((book) => (
              <CoverTile key={book.id} book={book} showEpisodeCount onPress={() => openBook(book)} />
            ))}
          </SectionRow>
        ))}

        {visible.length === 0 && status !== 'error' ? (
          <VStack className="items-center gap-1.5 px-8 pt-16">
            <Text className="font-display text-[18px] text-foreground">Nothing here yet</Text>
            <Text className="text-center font-inter text-[14px] text-muted-foreground">
              {query.trim()
                ? `No books match “${query.trim()}”${category === 'All' ? '' : ` in ${category}`}.`
                : `We haven’t added any ${category} series yet.`}
            </Text>
          </VStack>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** "+ My List" toggle for a series (saved through the API). */
function SaveButton({ bookId, title }: { bookId: string; title: string }) {
  const { isSaved, toggle } = useSaved();
  const saved = isSaved('BOOK', bookId);
  return (
    <IconButton
      icon={saved ? 'check' : 'plus'}
      variant="outline"
      size={48}
      radius={12}
      selected={saved}
      accessibilityLabel={saved ? `Remove ${title} from My List` : `Add ${title} to My List`}
      onPress={() => toggle('BOOK', bookId)}
    />
  );
}

/** Launched offline with downloads on the device: the catalog couldn't load, downloads still play. */
function OfflineNotice({ retry, retrying }: { retry: () => void; retrying: boolean }) {
  return (
    <Box className="px-5 pb-3">
      <VStack className="gap-3 rounded-[18px] border border-border bg-card p-4">
        <HStack className="items-center gap-2.5">
          <Icon name="offline" size={18} className="text-muted-foreground" />
          <Text className="flex-1 font-inter-semibold text-[15px] text-foreground">You’re offline</Text>
        </HStack>
        <Text className="font-inter text-[14px] leading-[21px] text-muted-foreground">
          Your downloaded episodes are ready to watch. Connect to browse everything else.
        </Text>
        <HStack className="gap-2.5">
          <BrandButton label="Go to Downloads" height={44} onPress={() => router.navigate('/profile/downloads')} className="flex-1" />
          <BrandButton label="Try again" variant="outline" height={44} loading={retrying} onPress={retry} className="flex-1" />
        </HStack>
      </VStack>
    </Box>
  );
}
