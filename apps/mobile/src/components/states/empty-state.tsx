import type { ReactNode } from 'react';

import { BrandButton } from '@/components/mintsy/brand-button';
import { Icon, type IconName } from '@/components/mintsy/icon';
import { Center } from '@/components/ui/center';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  body?: string;
  /** The next step, e.g. "Browse series". */
  actionLabel?: string;
  onAction?: () => void;
  /** Tints the icon for errors. */
  tone?: 'brand' | 'muted' | 'error';
  children?: ReactNode;
  className?: string;
};

/** Centered icon, title, body and a next step (design 51). */
export function EmptyState({ icon, title, body, actionLabel, onAction, tone = 'brand', children, className = '' }: EmptyStateProps) {
  const iconColor = tone === 'error' ? 'text-destructive' : tone === 'muted' ? 'text-muted-foreground' : 'text-brand';
  return (
    <VStack className={`items-center gap-3 px-8 ${className}`}>
      <Center
        className={`h-[72px] w-[72px] rounded-full border ${tone === 'error' ? 'border-destructive/20 bg-destructive/10' : 'border-border bg-card'}`}
      >
        <Icon name={icon} size={30} className={iconColor} />
      </Center>
      <Text accessibilityRole="header" className="text-center font-display text-[22px] leading-[27px] text-foreground">
        {title}
      </Text>
      {body ? (
        <Text className="max-w-[320px] text-center font-inter text-[15px] leading-[22px] text-muted-foreground">{body}</Text>
      ) : null}
      {actionLabel && onAction ? <BrandButton label={actionLabel} onPress={onAction} className="mt-2 px-[22px]" /> : null}
      {children}
    </VStack>
  );
}
