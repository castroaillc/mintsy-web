import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

type WordmarkProps = {
  /** `text` = "mintsy." wordmark; `tile` = the square "m." app mark. */
  variant?: 'text' | 'tile';
  /** Font size of the wordmark, or the tile's edge length. */
  size?: number;
  /** Text wordmark drawn on an always-dark tint (e.g. the wide welcome's cover pane). */
  onTint?: boolean;
};

export function Wordmark({ variant = 'text', size, onTint }: WordmarkProps) {
  if (variant === 'tile') {
    const edge = size ?? 40;
    const font = Math.round(edge * 0.7);
    return (
      <Box
        accessible
        accessibilityRole="image"
        accessibilityLabel="mintsy"
        style={{ width: edge, height: edge, borderRadius: Math.round(edge / 4) }}
        className="items-center justify-center border border-border bg-card"
      >
        {/* Space Grotesk sits low in its line box; nudge the glyphs up to center them */}
        <Text
          style={{ fontSize: font, lineHeight: font, marginTop: -Math.round(font * 0.2) }}
          className="font-display tracking-[-1px] text-foreground"
        >
          m<Text style={{ fontSize: font, lineHeight: font }} className="font-display text-brand">.</Text>
        </Text>
      </Box>
    );
  }
  const font = size ?? 22;
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: font, letterSpacing: font >= 26 ? -0.6 : -0.5 }}
      className={`font-display ${onTint ? 'text-on-tint' : 'text-foreground'}`}
    >
      mintsy<Text style={{ fontSize: font }} className="font-display text-brand">.</Text>
    </Text>
  );
}
