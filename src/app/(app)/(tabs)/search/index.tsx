import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { CoverTile } from '@/components/mintsy/cover-tile';
import { Icon } from '@/components/mintsy/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputSlot } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { BOOKS } from '@/data/mock';

/** Placeholder: a simple filterable catalog until real search exists. */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const results = BOOKS.filter((b) =>
    [b.title, b.author, b.category].some((field) => field.toLowerCase().includes(q)),
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 px-5 pb-8 pt-5"
      >
        <Text accessibilityRole="header" className="font-display text-[26px] text-foreground">
          Search
        </Text>
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
        <Text className="font-inter text-[13px] text-muted-foreground">
          {results.length} series
        </Text>
        <HStack className="flex-wrap gap-3">
          {results.map((book) => (
            <CoverTile
              key={book.id}
              book={book}
              showEpisodeCount
              width={104}
              onPress={() => router.navigate({ pathname: '/book/[id]', params: { id: book.id } })}
            />
          ))}
        </HStack>
        {results.length === 0 ? (
          <Box className="items-center pt-10">
            <Text className="font-inter text-[14px] text-muted-foreground">No books match “{query.trim()}”.</Text>
          </Box>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
