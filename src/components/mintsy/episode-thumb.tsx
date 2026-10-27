import { Icon } from '@/components/mintsy/icon';
import { ProgressBar } from '@/components/mintsy/progress-bar';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { Episode } from '@/data/mock';
import { episodeTint, formatTime } from '@/lib/series';

type EpisodeThumbProps = {
  episode: Episode;
  /** 0–1; omit to hide the bar. */
  progress?: number;
  /** 132×76 in lists, 112×64 in "Up next". */
  size?: 'md' | 'sm';
};

/** Tinted chapter thumbnail with number, play badge, duration and progress. */
export function EpisodeThumb({ episode, progress, size = 'md' }: EpisodeThumbProps) {
  const md = size === 'md';
  return (
    <Box
      style={{ backgroundColor: episodeTint(episode) }}
      className={`overflow-hidden ${md ? 'h-[76px] w-[132px] rounded-[10px]' : 'h-16 w-28 rounded-lg'}`}
    >
      <Text
        className={`absolute font-display text-on-tint ${md ? 'left-2.5 top-2 text-[22px]' : 'left-2 top-1.5 text-[18px]'}`}
      >
        {episode.number}
      </Text>
      {md ? (
        <Box className="absolute left-1/2 top-1/2 -ml-4 -mt-4 h-8 w-8 items-center justify-center rounded-full bg-scrim/70">
          <Icon name="play" size={12} className="text-on-scrim" />
        </Box>
      ) : null}
      <Box
        className={`absolute right-1.5 h-[18px] justify-center rounded px-[5px] bg-scrim/80 ${md ? 'bottom-[9px]' : 'bottom-1.5'}`}
      >
        <Text className="font-inter-semibold text-[11px] text-on-scrim">{formatTime(episode.durationSec)}</Text>
      </Box>
      {progress !== undefined ? (
        <ProgressBar value={progress} trackClassName="bg-on-scrim/15" className="absolute bottom-0 left-0 right-0" />
      ) : null}
    </Box>
  );
}
