import { Box } from '@/components/ui/box';

type ProgressBarProps = {
  /** 0–1 */
  value: number;
  height?: number;
  rounded?: boolean;
  /** Track color. Use `bg-on-scrim/20` when drawn over tinted art. */
  trackClassName?: string;
  className?: string;
};

export function ProgressBar({
  value,
  height = 4,
  rounded = false,
  trackClassName = 'bg-border',
  className = '',
}: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const radius = rounded ? height / 2 : 0;
  return (
    <Box
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={{ height, borderRadius: radius }}
      className={`w-full overflow-hidden ${trackClassName} ${className}`}
    >
      <Box style={{ width: `${pct}%`, height, borderRadius: radius }} className="bg-brand" />
    </Box>
  );
}
