import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/mintsy/icon';
import { Spinner } from '@/components/mintsy/spinner';
import { Text } from '@/components/ui/text';

type BrandButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  /** 44 (compact), 48, 52 (hero) or 56 (paywall CTA). */
  height?: number;
  /** `outline` is the quiet secondary action next to a brand button. */
  variant?: 'brand' | 'outline';
  accessibilityHint?: string;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  /** Selector for end-to-end tests. */
  testID?: string;
};

export function BrandButton({
  label,
  onPress,
  icon,
  height = 48,
  variant = 'brand',
  accessibilityHint,
  loading,
  disabled,
  className = '',
  testID,
}: BrandButtonProps) {
  const brand = variant === 'brand';
  const inactive = disabled || loading;
  const textSize = height >= 56 ? 'text-[17px]' : height >= 52 ? 'text-[16px]' : height >= 48 ? 'text-[15px]' : 'text-[14px]';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={{ height: Math.max(44, height) }}
      className={`flex-row items-center justify-center gap-2 px-4 active:opacity-80 ${
        height >= 54 ? 'rounded-[14px]' : height >= 48 ? 'rounded-xl' : 'rounded-[10px]'
      } ${brand ? (disabled ? 'bg-border' : 'bg-brand') : 'border border-border-strong'} ${className}`}
    >
      {loading ? (
        <Spinner className={brand ? 'text-brand-foreground' : 'text-foreground'} />
      ) : icon ? (
        <Icon name={icon} size={height >= 48 ? 16 : 14} className={brand ? 'text-brand-foreground' : 'text-foreground'} />
      ) : null}
      <Text
        numberOfLines={1}
        className={`${textSize} ${
          brand
            ? `font-inter-semibold ${disabled ? 'text-muted-foreground' : 'text-brand-foreground'}`
            : `${height >= 54 ? 'font-inter-semibold' : 'font-inter-medium'} text-foreground`
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
