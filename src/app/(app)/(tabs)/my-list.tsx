import { Icon } from '@/components/mintsy/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** Placeholder until saving to My List is wired up. */
export default function MyListScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <VStack className="flex-1 px-5 pt-5">
        <Text accessibilityRole="header" className="font-display text-[26px] text-foreground">
          My List
        </Text>
        <Center className="flex-1 gap-3 px-6">
          <Center className="h-16 w-16 rounded-full bg-tag">
            <Icon name="bookmark" size={26} className="text-brand" />
          </Center>
          <Text className="font-display text-[18px] text-foreground">Nothing saved yet</Text>
          <Text className="text-center font-inter text-[14px] leading-[21px] text-muted-foreground">
            Series and episodes you save will show up here.
          </Text>
        </Center>
      </VStack>
    </SafeAreaView>
  );
}
