import { Icon } from '@/components/mintsy/icon';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

/** Inline error banner for auth forms. */
export function FormAlert({ message }: { message: string }) {
  return (
    <HStack
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3.5 py-3"
    >
      <Icon name="alert" size={18} className="mt-px text-destructive" />
      <Text className="flex-1 font-inter text-[14px] leading-[20px] text-destructive">{message}</Text>
    </HStack>
  );
}
