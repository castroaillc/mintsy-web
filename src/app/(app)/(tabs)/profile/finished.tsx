import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { CoverTile } from '@/components/mintsy/cover-tile';
import { ScreenHeader } from '@/components/mintsy/screen-header';
import { SafeAreaView } from '@/components/safe-area-view';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { useCatalog } from '@/lib/catalog';
import { useProgress } from '@/lib/progress';
import { finishedBooks } from '@/lib/stats';

export default function FinishedScreen() {
  const { progress } = useProgress();
  const catalog = useCatalog();
  const books = finishedBooks(catalog.books, progress);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-background">
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-5 px-5 pb-10 pt-3">
        <ScreenHeader title="Finished" backHref="/profile" backLabel="Back to profile" />
        {books.length > 0 ? (
          <HStack className="flex-wrap gap-3">
            {books.map((book) => (
              <CoverTile
                key={book.id}
                book={book}
                width={104}
                showEpisodeCount
                onPress={() => router.navigate({ pathname: '/book/[id]', params: { id: book.id } })}
              />
            ))}
          </HStack>
        ) : (
          <Text className="pt-10 text-center font-inter text-[14px] leading-[21px] text-muted-foreground">
            Series you watch all the way through will show up here.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
