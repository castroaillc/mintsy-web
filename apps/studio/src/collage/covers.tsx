import { getTheme, logoPaths } from "@mintsy/brand";
/**
 * Still images in the collage style: the episode thumbnail (16:9) and the book cover (2:3).
 * Both are rendered with renderStill; they read at the app's smallest sizes (132pt thumbnails,
 * 48pt cover tiles), so type is big and there is one hero element.
 */
import { AbsoluteFill } from "remotion";

import { display } from "../episode/theme";
import { ICONS } from "./icons";
import { Cutout, condensed, Figure, PaperFinish, palette, Stripes } from "./kit";
import { BACKGROUNDS } from "./Layouts";
import type { CollageEpisodeProps, Prop } from "./schema";

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Every prop (icon or figure) anywhere in the scenes, in order. */
function allProps(value: unknown, found: Prop[] = []): Prop[] {
  if (Array.isArray(value)) value.forEach((v) => allProps(v, found));
  else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if ((o.kind === "figure" || o.kind === "icon") && typeof o.cue === "string") found.push(o as Prop);
    else Object.values(o).forEach((v) => allProps(v, found));
  }
  return found;
}

/** The word to color: the longest one, which is usually the most meaningful. */
function keyWord(title: string) {
  const words = title.split(/\s+/);
  return words.reduce((best, w) => (w.replace(/\W/g, "").length > best.replace(/\W/g, "").length ? w : best), words[0] ?? "");
}

function relativeLuminance(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return 0.5;
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Oswald caps average about 0.56em per character; keep the longest word within `width`. */
function fitSize(text: string, preferred: number, width: number) {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), 1);
  return Math.min(preferred, Math.floor(width / (longest * 0.56)));
}

/** Stable small hash, so a book always gets the same emblem. */
function hash(s: string) {
  // FNV-1a: mixes well even for titles that share long prefixes
  let h = 0x811c9dc5;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return h;
}

/** Same rule as the app's coverInk(): dark ink on light tones, light ink on dark ones. */
function inkFor(tone: string) {
  return relativeLuminance(tone) > 0.35 ? palette.ink : palette.white;
}

/** Mixes a hex color toward black (amount < 0) or white (amount > 0). */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  };
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

const Tape: React.FC<{ text: string; color: string; ink: string; size: number; rotate?: number }> = ({
  text,
  color,
  ink,
  size,
  rotate = -2,
}) => (
  <div
    style={{
      alignSelf: "flex-start",
      backgroundColor: color,
      color: ink,
      fontFamily: condensed,
      fontWeight: 700,
      fontSize: size,
      textTransform: "uppercase",
      padding: `${size * 0.12}px ${size * 0.4}px`,
      boxShadow: `${size * 0.16}px ${size * 0.16}px 0 ${palette.ink}`,
      rotate: `${rotate}deg`,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

const Sticker: React.FC<{ icon: string; color: string; edge: number }> = ({ icon, color, edge }) => {
  const Icon = ICONS[icon as keyof typeof ICONS] ?? ICONS.star;
  return (
    <div
      style={{
        width: edge,
        height: edge,
        borderRadius: "50%",
        backgroundColor: palette.cream,
        border: `${edge * 0.045}px solid ${palette.ink}`,
        boxShadow: `${edge * 0.06}px ${edge * 0.06}px 0 ${palette.ink}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={edge * 0.6} weight="fill" color={color} />
    </div>
  );
};

// ─── Episode thumbnail ─────────────────────────────────────────────────────

/** 16:9 thumbnail: book title, episode title in condensed caps with one word colored, and the episode's hero prop. */
export const CollageThumbnail: React.FC<CollageEpisodeProps> = ({ scenes, episodeTitle, bookTitle }) => {
  const first = scenes[0]?.beats[0];
  const bg = BACKGROUNDS[first?.background ?? "plum"];
  const props = allProps(scenes);
  const hero = props.find((p) => p.kind === "figure") ?? props.find((p) => p.kind === "icon");
  const accent = bg.a === palette.pink ? palette.yellow : palette.pink;
  const word = keyWord(episodeTitle);
  const words = episodeTitle.split(/\s+/);
  const size = fitSize(episodeTitle, episodeTitle.length > 34 ? 104 : episodeTitle.length > 22 ? 124 : 148, 700);

  return (
    <AbsoluteFill>
      <Stripes a={bg.a} b={bg.b} width={58} />
      {/* Paper panel behind the title keeps it readable on busy stripes */}
      <Cutout
        color={palette.ink}
        style={{ position: "absolute", left: 56, top: 70, width: 770, height: 580, rotate: "-1.5deg", boxShadow: "none" }}
      />
      <AbsoluteFill style={{ left: 96, top: 104, width: 700, height: 520, display: "flex", flexDirection: "column", gap: 22 }}>
        {/* No episode number here: the apps draw it over the thumbnail's top-left corner */}
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 34, color: accent, paddingLeft: 70 }}>{bookTitle}</div>
        <div
          style={{
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 0.98,
            textTransform: "uppercase",
            color: palette.white,
            display: "flex",
            flexWrap: "wrap",
            columnGap: size * 0.22,
          }}
        >
          {words.map((w, i) => (
            <span key={i} style={{ color: w === word ? accent : palette.white }}>
              {w}
            </span>
          ))}
        </div>
      </AbsoluteFill>
      {hero ? (
        <div style={{ position: "absolute", left: 1040, top: 380, translate: "-50% -50%", rotate: "4deg" }}>
          {/* Colored disc grounds the hero against the stripes */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 400,
              height: 400,
              translate: "-50% -50%",
              borderRadius: "50%",
              backgroundColor: accent,
              border: `10px solid ${palette.ink}`,
              boxShadow: `14px 14px 0 ${palette.ink}`,
            }}
          />
          {hero.kind === "figure" ? (
            <div style={{ scale: "1.45", translate: "0 10px" }}>
              {/* Thumbnails want an expressive face */}
              <Figure body={palette[hero.outfit]} hat={hero.hat} mood={hero.mood === "sad" ? "surprised" : "happy"} hatAt={-10} blinkOffset={50} scale={1} />
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              <Sticker icon={hero.icon} color={palette[hero.color]} edge={300} />
            </div>
          )}
        </div>
      ) : null}
      <PaperFinish />
    </AbsoluteFill>
  );
};

// ─── Book cover ────────────────────────────────────────────────────────────

export type BookCoverProps = { title: string; author: string; category?: string; coverTone: string };

/** Emblems per category; each book picks one by title so neighbours on a shelf differ. */
const CATEGORY_ICONS: Record<string, string[]> = {
  Finance: ["coins", "piggy-bank", "chart-up", "bank", "wallet", "money"],
  Business: ["briefcase", "rocket", "store", "handshake", "chart-bar", "lightbulb"],
  Psychology: ["brain", "eye", "puzzle", "smiley-meh", "compass"],
  Productivity: ["target", "clock", "hourglass", "lightning", "check", "path"],
  History: ["scroll", "crown", "globe", "map-pin", "flag"],
  Health: ["heart", "leaf", "barbell", "sun", "drop"],
};
const EMBLEM_COLORS = [palette.pink, palette.gold, palette.teal, palette.mint];

/** 2:3 cover on the book's tone: category tape, big title, author, category emblem, mintsy mark. */
export const BookCover: React.FC<BookCoverProps> = ({ title, author, category, coverTone }) => {
  const ink = inkFor(coverTone);
  const icons = CATEGORY_ICONS[category ?? ""] ?? ["book-open", "lightbulb", "star"];
  const h = hash(title);
  const emblem = { icon: icons[h % icons.length], color: EMBLEM_COLORS[(h >>> 4) % EMBLEM_COLORS.length] };
  const size = fitSize(title, title.length > 40 ? 120 : title.length > 24 ? 150 : title.length > 14 ? 190 : 230, 832);

  return (
    <AbsoluteFill style={{ backgroundColor: coverTone }}>
      <Stripes a={coverTone} b={shade(coverTone, inkFor(coverTone) === palette.ink ? -0.06 : 0.08)} width={70} />
      <AbsoluteFill style={{ padding: "96px 84px 90px", display: "flex", flexDirection: "column" }}>
        {category ? <Tape text={category} color={palette.ink} ink={palette.cream} size={48} /> : null}
        <div
          style={{
            marginTop: 60,
            fontFamily: condensed,
            fontWeight: 700,
            fontSize: size,
            lineHeight: 0.95,
            textTransform: "uppercase",
            color: ink,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
        <div style={{ marginTop: 36, fontFamily: display, fontWeight: 700, fontSize: 58, color: ink, opacity: 0.85 }}>{author}</div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ rotate: "-6deg" }}>
            <Sticker icon={emblem.icon} color={emblem.color} edge={420} />
          </div>
          <svg
            viewBox={`0 0 ${logoPaths.wordmark.width} ${logoPaths.wordmark.height}`}
            width={(logoPaths.wordmark.width * 44) / 1000}
            height={(logoPaths.wordmark.height * 44) / 1000}
          >
            <path d={logoPaths.wordmark.letters} fill={ink} />
            <path d={logoPaths.wordmark.dot} fill={getTheme("ink-coral", "dark").brand} />
          </svg>
        </div>
      </AbsoluteFill>
      <PaperFinish vignette={0.2} />
    </AbsoluteFill>
  );
};
