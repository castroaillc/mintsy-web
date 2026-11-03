import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import { EPISODE_TINTS } from '@/data/types';

/** Initial on a tinted circle with a brand ring. Photos come later. */
export function Avatar({ name, size = 76 }: { name?: string; size?: number }) {
  const initial = name?.trim().charAt(0).toUpperCase() || '?';
  const fontSize = Math.round(size * 0.4);
  return (
    <Box
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: EPISODE_TINTS[0] }}
      className="items-center justify-center border-2 border-brand"
    >
      {/* Text's default line height is too short for this font size and clips the glyph */}
      <Text style={{ fontSize, lineHeight: Math.round(fontSize * 1.3) }} className="font-display text-on-tint">
        {initial}
      </Text>
    </Box>
  );
}
