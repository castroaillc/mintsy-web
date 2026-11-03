import { useState } from 'react';
import { Pressable } from 'react-native';

import { BrandButton } from '@/components/mintsy/brand-button';
import { EmptyState } from '@/components/states/empty-state';
import { Text } from '@/components/ui/text';
import { VStack } from '@/components/ui/vstack';

/** Short code to quote to support; the same code is logged with the error. */
export function makeErrorRef(error?: unknown, context = 'error') {
  const ref = `M-${Date.now().toString(36).slice(-5).toUpperCase()}`;
  console.warn(`[${ref}] ${context}`, error);
  return ref;
}

type ErrorStateProps = {
  title: string;
  body?: string;
  onRetry: () => void;
  retrying?: boolean;
  /** A secondary way out, e.g. "Go to Home". */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Shown as "Error ref: …" so support can find the log line. */
  errorRef?: string;
};

/** "Couldn't load …" with Try again and a short error reference (design 51). */
export function ErrorState({
  title,
  body = 'Something went wrong on our side. Your progress is safe.',
  onRetry,
  retrying,
  secondaryLabel,
  onSecondary,
  errorRef,
}: ErrorStateProps) {
  return (
    <VStack accessibilityRole="alert" className="flex-1 justify-center gap-6 py-10">
      <EmptyState icon="alert" tone="error" title={title} body={body}>
        <BrandButton label="Try again" loading={retrying} onPress={onRetry} className="mt-2 px-[26px]" />
        {secondaryLabel && onSecondary ? (
          <Pressable accessibilityRole="button" onPress={onSecondary} className="h-11 justify-center px-3">
            <Text className="font-inter text-[15px] text-muted-foreground">{secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </EmptyState>
      {errorRef ? <Text className="text-center font-inter text-[12px] text-faint">Error ref: {errorRef}</Text> : null}
    </VStack>
  );
}

/** Keeps one error reference per failure, so re-renders don't change the code on screen. */
export function useErrorRef() {
  const [ref, setRef] = useState<string>();
  return {
    ref,
    report: (error: unknown, context?: string) => setRef(makeErrorRef(error, context)),
    clear: () => setRef(undefined),
  };
}
