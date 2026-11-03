import { getTheme, logoPaths } from '@mintsy/brand';
import { useColorScheme } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Box } from '@/components/ui/box';

type WordmarkProps = {
  /** `text` = "mintsy." wordmark; `tile` = the square "m." app mark. */
  variant?: 'text' | 'tile';
  /** Font size of the wordmark, or the tile's edge length. */
  size?: number;
  /** Text wordmark drawn on an always-dark tint (e.g. the wide welcome's cover pane). */
  onTint?: boolean;
};

/** The official logo outlines. They're in 1000-unit em squares, so a scale of `size / 1000` matches a font size. */
function Outline({ path, size, letters, dot }: { path: typeof logoPaths.wordmark; size: number; letters: string; dot: string }) {
  return (
    <Svg width={(path.width * size) / 1000} height={(path.height * size) / 1000} viewBox={`0 0 ${path.width} ${path.height}`}>
      <Path d={path.letters} fill={letters} />
      <Path d={path.dot} fill={dot} />
    </Svg>
  );
}

export function Wordmark({ variant = 'text', size, onTint }: WordmarkProps) {
  const colors = getTheme('ink-coral', useColorScheme() === 'dark' ? 'dark' : 'light');

  if (variant === 'tile') {
    const edge = size ?? 40;
    return (
      <Box
        accessible
        accessibilityRole="image"
        accessibilityLabel="mintsy"
        style={{ width: edge, height: edge, borderRadius: Math.round(edge / 4) }}
        className="items-center justify-center border border-border bg-card"
      >
        <Outline path={logoPaths.mark} size={Math.round(edge * 0.7)} letters={colors.foreground} dot={colors.brand} />
      </Box>
    );
  }
  return (
    <Box accessible accessibilityRole="header" accessibilityLabel="mintsy">
      <Outline
        path={logoPaths.wordmark}
        size={size ?? 22}
        letters={onTint ? colors.onTint : colors.foreground}
        dot={colors.brand}
      />
    </Box>
  );
}
