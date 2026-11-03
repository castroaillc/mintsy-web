import { Icon } from '@/components/mintsy/icon';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

/** Blue status banner for offline states (design 51). */
export function OfflineBanner({ message = 'You’re offline. Your downloaded episodes still play.', className = '' }: { message?: string; className?: string }) {
  return (
    <HStack
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`items-center gap-2.5 rounded-xl border border-[#2E3A52] bg-[#1B2230] px-3.5 py-3 ${className}`}
    >
      <Icon name="offline" size={16} className="text-[#C8D6F2]" />
      <Text className="flex-1 font-inter text-[14px] leading-[20px] text-[#C8D6F2]">{message}</Text>
    </HStack>
  );
}
