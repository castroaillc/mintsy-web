import { Pressable } from 'react-native';

import { Icon, type IconName } from '@/components/mintsy/icon';

const VARIANTS = {
  /** Translucent dark circle for controls drawn over tinted art. */
  scrim: { box: 'bg-scrim/60', icon: 'text-on-scrim' },
  /** Bordered, transparent. */
  outline: { box: 'border border-border-strong', icon: 'text-foreground' },
  /** Raised surface with a border. */
  surface: { box: 'border border-input bg-surface-raised', icon: 'text-foreground' },
  brand: { box: 'bg-brand', icon: 'text-brand-foreground' },
  /** No background; for back chevrons on plain screens. */
  ghost: { box: '', icon: 'text-foreground' },
} as const;

type IconButtonProps = {
  icon: IconName;
  /** Required: icon-only buttons have no visible label. */
  accessibilityLabel: string;
  onPress?: () => void;
  variant?: keyof typeof VARIANTS;
  /** Outer size in points; never below the 44pt touch target. */
  size?: number;
  iconSize?: number;
  /** Corner radius; defaults to a circle. */
  radius?: number;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
};

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'scrim',
  size = 44,
  iconSize = 20,
  radius,
  selected,
  disabled,
  className = '',
}: IconButtonProps) {
  const styles = VARIANTS[variant];
  const outer = Math.max(44, size);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selected === undefined && !disabled ? undefined : { selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ width: outer, height: outer, borderRadius: radius ?? outer / 2 }}
      className={`items-center justify-center active:opacity-70 ${disabled ? 'opacity-40' : ''} ${styles.box} ${className}`}
    >
      <Icon name={icon} size={iconSize} className={styles.icon} />
    </Pressable>
  );
}
