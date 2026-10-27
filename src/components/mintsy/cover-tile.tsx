import { Pressable } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { coverInk, type Book } from '@/data/mock';

type Preset = {
  title: number;
  /** Author font size; 0 hides the author (tiny thumbnails). */
  author: number;
  padV: number;
  padH: number;
  radius: number;
  leading: number;
  shadow?: string;
};

/** Measurements from the mockups, keyed by tile width. */
const PRESETS: Record<number, Preset> = {
  48: { title: 8, author: 0, padV: 6, padH: 5, radius: 5, leading: 1.1 },
  72: { title: 11, author: 8, padV: 8, padH: 7, radius: 6, leading: 1.1 },
  104: { title: 14, author: 10, padV: 11, padH: 10, radius: 8, leading: 1.08 },
  124: { title: 16, author: 11, padV: 12, padH: 11, radius: 8, leading: 1.08 },
  128: { title: 17, author: 10, padV: 14, padH: 12, radius: 8, leading: 1.05, shadow: '0 16px 36px rgba(0, 0, 0, 0.45)' },
  132: { title: 19, author: 11, padV: 14, padH: 12, radius: 6, leading: 1.05, shadow: '0 18px 40px rgba(0, 0, 0, 0.45)' },
  150: { title: 22, author: 12, padV: 16, padH: 14, radius: 6, leading: 1.05, shadow: '0 22px 48px rgba(0, 0, 0, 0.5)' },
  152: { title: 21, author: 11, padV: 16, padH: 14, radius: 8, leading: 1.05, shadow: '0 22px 48px rgba(0, 0, 0, 0.55)' },
};
const SIZES = Object.keys(PRESETS).map(Number);

function presetFor(width: number) {
  const nearest = SIZES.reduce((best, size) => (Math.abs(size - width) < Math.abs(best - width) ? size : best));
  return PRESETS[nearest];
}

type CoverTileProps = {
  book: Book;
  /** Tile width; height keeps a 2:3 ratio. Sizes used in the mockups: 48, 72, 124, 128, 132, 150, 152. */
  width?: number;
  showEpisodeCount?: boolean;
  onPress?: () => void;
};

/** Generated cover: solid tone, title in Space Grotesk, author underneath. */
export function CoverTile({ book, width = 124, showEpisodeCount, onPress }: CoverTileProps) {
  const p = presetFor(width);
  const ink = coverInk(book.coverTone);

  const tile = (
    <Box
      style={{
        width,
        height: Math.round(width * 1.5),
        backgroundColor: book.coverTone,
        borderRadius: p.radius,
        paddingTop: showEpisodeCount ? 34 : p.padV,
        paddingBottom: p.padV,
        paddingHorizontal: p.padH,
        boxShadow: p.shadow,
      }}
      className={`${p.author ? 'justify-between' : ''} ${p.shadow ? '' : 'overflow-hidden'}`}
    >
      {showEpisodeCount ? (
        <Box className="absolute left-2 top-2 h-5 justify-center rounded-full bg-scrim/80 px-[7px]">
          <Text className="font-inter-semibold text-[11px] text-on-scrim">{book.episodes.length} eps</Text>
        </Box>
      ) : null}
      <Text
        numberOfLines={p.author ? 5 : 6}
        style={{ color: ink, fontSize: p.title, lineHeight: Math.round(p.title * p.leading) + 1 }}
        className="font-display"
      >
        {book.title}
      </Text>
      {p.author ? (
        <Text numberOfLines={2} style={{ color: ink, fontSize: p.author }} className="font-inter-medium">
          {book.author}
        </Text>
      ) : null}
    </Box>
  );

  if (!onPress) return tile;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}, ${book.episodes.length} episodes`}
      onPress={onPress}
      className="active:opacity-80"
    >
      {tile}
    </Pressable>
  );
}
