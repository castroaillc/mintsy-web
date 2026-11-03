import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';

type SegmentedProgressProps = {
  /** One entry per episode: true when watched. */
  watched: boolean[];
  currentIndex: number;
  className?: string;
};

/** Series strip: watched = brand, current = foreground, upcoming = border. */
export function SegmentedProgress({ watched, currentIndex, className = '' }: SegmentedProgressProps) {
  const done = watched.filter(Boolean).length;
  return (
    <HStack
      accessible
      accessibilityLabel={`Episode ${currentIndex + 1} of ${watched.length}, ${done} watched`}
      className={`gap-[3px] ${className}`}
    >
      {watched.map((isWatched, i) => (
        <Box
          key={i}
          className={`h-1 flex-1 rounded-sm ${
            i === currentIndex ? 'bg-foreground' : isWatched ? 'bg-brand' : 'bg-input'
          }`}
        />
      ))}
    </HStack>
  );
}
