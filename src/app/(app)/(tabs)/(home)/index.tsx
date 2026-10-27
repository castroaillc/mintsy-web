import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';

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
import {
  BOOKS,
  CATEGORIES,
  FEATURED_BOOK_ID,
  NEW_THIS_WEEK_IDS,
  getBook,
  type Book,
  type CategoryFilter,
} from '@/data/mock';
import { authClient } from '@/lib/auth-client';
import { useProgress } from '@/lib/progress';
import { inProgressEpisode } from '@/lib/series';

function matchesQuery(book: Book, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [book.title, book.author, book.category].some((field) => field.toLowerCase().includes(q));
}

function openBook(book: Book) {
  router.push({ pathname: '/book/[id]', params: { id: book.id } });
}

function openPlayer(episodeId: string) {
  router.push({ pathname: '/player/[episodeId]', params: { episodeId } });
}

export default function BrowseScreen() {
  const { data: session } = authClient.useSession();
  const { progress } = useProgress();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('All');

  const visible = BOOKS.filter(
    (b) => (category === 'All' || b.category === category) && matchesQuery(b, query),
  );
  const featured = getBook(FEATURED_BOOK_ID)!;
  const showFeatured = visible.includes(featured) && !query.trim();

  const continueList = visible.flatMap((book) => {
    const episode = inProgressEpisode(book, progress);
    return episode ? [{ book, episode }] : [];
  });

  const topCategory = category === 'All' ? 'Finance' : category;
  const rows = [
    { title: `Top in ${topCategory}`, books: visible.filter((b) => b.category === topCategory) },
    { title: 'New this week', books: visible.filter((b) => NEW_THIS_WEEK_IDS.includes(b.id)) },
  ].filter((row) => row.books.length > 0);

  const initial = session?.user.name?.trim().charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="pb-8"
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

        {showFeatured ? (
          <Box className="px-5 pt-5">
            <Box className="overflow-hidden rounded-[22px] border border-border bg-surface-raised">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${featured.title}`}
                onPress={() => openBook(featured)}
                style={{ backgroundColor: featured.tint }}
                className="h-[250px] items-center justify-center"
              >
                <CoverTile book={featured} width={132} />
              </Pressable>
              <VStack className="gap-2.5 px-[18px] pb-5 pt-[18px]">
                <Text className="font-inter-semibold text-[12px] uppercase tracking-[1.2px] text-brand">
                  Featured series
                </Text>
                <Pressable accessibilityRole="link" onPress={() => openBook(featured)}>
                  <Text className="font-display text-[24px] leading-[28px] text-foreground">{featured.title}</Text>
                </Pressable>
                <Text className="font-inter text-[14px] text-muted-foreground">
                  {featured.author} · {featured.episodes.length} episodes · 5 min each
                </Text>
                <HStack className="mt-1.5 gap-2.5">
                  <BrandButton
                    label="Play Episode 1"
                    icon="play"
                    onPress={() => openPlayer(featured.episodes[0].id)}
                    className="flex-1"
                  />
                  <SaveButton title={featured.title} />
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
                onPress={() => openPlayer(episode.id)}
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

        {visible.length === 0 ? (
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

/** Visual-only "+ My List" toggle until saving has a backend. */
function SaveButton({ title }: { title: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <IconButton
      icon={saved ? 'check' : 'plus'}
      variant="outline"
      size={48}
      radius={12}
      selected={saved}
      accessibilityLabel={saved ? `Remove ${title} from My List` : `Add ${title} to My List`}
      onPress={() => setSaved((s) => !s)}
    />
  );
}
