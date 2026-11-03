import { Icon } from '@/components/mintsy/icon';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';

type FormAlertProps = {
  message: string;
  /** `success` for confirmations (e.g. "Password updated"); errors by default. */
  tone?: 'error' | 'success';
};

/** Inline banner for auth and account forms. */
export function FormAlert({ message, tone = 'error' }: FormAlertProps) {
  const success = tone === 'success';
  return (
    <HStack
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`items-start gap-2.5 rounded-xl border px-3.5 py-3 ${
        success ? 'border-brand/40 bg-brand/10' : 'border-destructive/40 bg-destructive/10'
      }`}
    >
      <Icon name={success ? 'checkCircle' : 'alert'} size={18} className={`mt-px ${success ? 'text-brand' : 'text-destructive'}`} />
      <Text className={`flex-1 font-inter text-[14px] leading-[20px] ${success ? 'text-foreground' : 'text-destructive'}`}>
        {message}
      </Text>
    </HStack>
  );
}
