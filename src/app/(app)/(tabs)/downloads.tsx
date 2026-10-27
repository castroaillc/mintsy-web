import { Icon } from '@/components/mintsy/icon';
import { ScreenHeader } from '@/components/mintsy/screen-header';
import { SafeAreaView } from '@/components/safe-area-view';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** Placeholder until offline downloads exist. */
export default function DownloadsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <VStack className="flex-1 px-5 pt-5">
        <ScreenHeader title="Downloads" />
        <Center className="flex-1 gap-3 px-6">
          <Center className="h-16 w-16 rounded-full bg-tag">
            <Icon name="download" size={26} className="text-brand" />
          </Center>
          <Text className="font-display text-[18px] text-foreground">No downloads yet</Text>
          <Text className="text-center font-inter text-[14px] leading-[21px] text-muted-foreground">
            Episodes you download will show up here so you can watch offline.
          </Text>
        </Center>
      </VStack>
    </SafeAreaView>
  );
}
