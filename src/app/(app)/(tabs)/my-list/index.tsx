import { router } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView } from 'react-native';

import { CoverTile } from '@/components/mintsy/cover-tile';
import { EpisodeThumb } from '@/components/mintsy/episode-thumb';
import { Icon } from '@/components/mintsy/icon';
import { IconButton } from '@/components/mintsy/icon-button';
import { Spinner } from '@/components/mintsy/spinner';
import { SafeAreaView } from '@/components/safe-area-view';
import { Center } from '@/components/ui/center';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';
import type { Book, Episode } from '@/data/types';
import { useCatalog } from '@/lib/catalog';
import { useIsLocked, useOpenEpisode } from '@/lib/premium';
import { useProgress } from '@/lib/progress';
import { useSaved } from '@/lib/saved';
import { countLabel, episodeFraction } from '@/lib/series';

/** Lists stay a comfortable width on wide windows (iPhone Duo open). */
const LIST_MAX_WIDTH = 720;

/** My List (not designed; follows Browse and Settings): saved series and episodes, most recently saved first. */
export default function MyListScreen() {
  const catalog = useCatalog();
  const saved = useSaved();
  const { progress } = useProgress();
  const openEpisode = useOpenEpisode();
  const isLocked = useIsLocked();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([saved.reload(), catalog.refresh()]).finally(() => setRefreshing(false));
  }, [saved, catalog]);

  // Ids no longer in the catalog (unpublished or removed) are left out
  const books = saved.bookIds.map((id) => catalog.getBook(id)).filter((b): b is Book => !!b);
  const episodes = saved.episodeIds
    .map((id) => catalog.findEpisode(id))
    .filter((f): f is { book: Book; episode: Episode } => !!f);
  const empty = books.length === 0 && episodes.length === 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="flex-grow px-5 pb-10 pt-5"
        contentContainerStyle={{ maxWidth: LIST_MAX_WIDTH + 40, width: '100%', alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text accessibilityRole="header" className="font-display text-[26px] text-foreground">
          My List
        </Text>

        {!saved.loaded ? (
          <Center className="flex-1">
            <Spinner className="text-muted-foreground" />
          </Center>
        ) : empty ? (
          <Center className="flex-1 gap-3 px-6">
            <Center className="h-16 w-16 rounded-full bg-tag">
              <Icon name="bookmark" size={26} className="text-brand" />
            </Center>
            <Text className="font-display text-[18px] text-foreground">Nothing saved yet</Text>
            <Text className="text-center font-inter text-[14px] leading-[21px] text-muted-foreground">
              {catalog.status === 'error'
                ? 'Connect to the internet to see the series and episodes you’ve saved.'
                : 'Series and episodes you save will show up here.'}
            </Text>
          </Center>
        ) : (
          <VStack className="mt-5 gap-[26px]">
            {books.length > 0 ? (
              <ListSection title="Series">
                {books.map((book) => (
                  <SavedRow
                    key={book.id}
                    label={`${book.title} by ${book.author}`}
                    onPress={() => router.push({ pathname: '/book/[id]', params: { id: book.id } })}
                    onRemove={() => saved.setSaved('BOOK', book.id, false)}
                    removeLabel={`Remove ${book.title} from My List`}
                    art={<CoverTile book={book} width={48} />}
                    eyebrow={book.category}
                    title={book.title}
                    sub={`${book.author} · ${countLabel(book.episodes.length, 'episode')}`}
                  />
                ))}
              </ListSection>
            ) : null}

            {episodes.length > 0 ? (
              <ListSection title="Episodes">
                {episodes.map(({ book, episode }) => {
                  const locked = isLocked(episode);
                  return (
                    <SavedRow
                      key={episode.id}
                      label={`${locked ? 'Premium, ' : ''}${book.title}, Episode ${episode.number}: ${episode.title}`}
                      onPress={() => openEpisode(episode)}
                      onRemove={() => saved.setSaved('EPISODE', episode.id, false)}
                      removeLabel={`Remove ${episode.title} from My List`}
                      art={
                        <EpisodeThumb
                          episode={episode}
                          size="sm"
                          locked={locked}
                          progress={progress[episode.id] ? episodeFraction(episode, progress[episode.id]) : undefined}
                        />
                      }
                      eyebrow={`${locked ? 'Premium · ' : ''}${book.title} · Episode ${episode.number}`}
                      title={episode.title}
                    />
                  );
                })}
              </ListSection>
            ) : null}
          </VStack>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ListSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <VStack className="gap-2.5">
      <Text accessibilityRole="header" className="ml-1 font-inter-semibold text-[13px] uppercase tracking-[1px] text-muted-foreground">
        {title}
      </Text>
      <VStack className="gap-2.5">{children}</VStack>
    </VStack>
  );
}

type SavedRowProps = {
  art: ReactNode;
  eyebrow: string;
  title: string;
  sub?: string;
  label: string;
  onPress: () => void;
  onRemove: () => void;
  removeLabel: string;
};

/** Card row: art, text, and a remove button. */
function SavedRow({ art, eyebrow, title, sub, label, onPress, onRemove, removeLabel }: SavedRowProps) {
  return (
    <HStack className="items-center rounded-[14px] border border-border bg-card">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        className="min-w-0 flex-1 flex-row items-center gap-3.5 p-3 active:opacity-80"
      >
        {art}
        <VStack className="min-w-0 flex-1 gap-[3px]">
          <Text numberOfLines={1} className="font-inter-semibold text-[12px] text-muted-foreground">
            {eyebrow}
          </Text>
          <Text numberOfLines={2} className="font-inter-semibold text-[15px] leading-[19px] text-foreground">
            {title}
          </Text>
          {sub ? (
            <Text numberOfLines={1} className="font-inter text-[13px] text-muted-foreground">
              {sub}
            </Text>
          ) : null}
        </VStack>
      </Pressable>
      <IconButton icon="close" variant="ghost" iconSize={16} accessibilityLabel={removeLabel} onPress={onRemove} className="mr-1.5" />
    </HStack>
  );
}
