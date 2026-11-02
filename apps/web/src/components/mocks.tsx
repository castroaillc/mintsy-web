/* eslint-disable @next/next/no-img-element -- static export, plain <img> */
import type { CSSProperties, ReactNode } from "react";

// The design embeds rendered app screens (CoralDuoSeriesOpen, CoralMain, CoralPlayer, CoralTranscriptReader,
// CoralDuoPlayerOpen, CoralDuoPlayerTabletop). Those aren't in the design file, so these are drawn in CSS from the
// app's layout, using frames and transcript lines from a real episode (Arnold Bennett, "How to Live on 24 Hours a Day",
// public domain). Swap in real screen renders when they exist.

/** n design pixels of the current screen */
const u = (n: number) => `calc(var(--u) * ${n})`;

const BOOK = { title: "How to Live on 24 Hours a Day", author: "Arnold Bennett", episodes: 12 };
const CHAPTERS = ["The Daily Miracle", "The Desire to Exceed One's Programme", "Precautions Before Beginning", "The Cause of the Trouble", "Tennis and the Immortal Soul", "Remember Human Nature"];
const LINES = [
  { t: "0:05", text: "Picture a man with a good job and a steady income." },
  { t: "0:08", text: "Enough for comforts and a few luxuries.", current: true },
  { t: "0:11", text: "He isn't reckless. And yet he's always in a mess." },
];

type Kind = "duo" | "tabletop" | "phone";
const FRAMES: Record<Kind, { w: number; aspect: string; pad: string; outer: string; inner: string; shadow: string }> = {
  duo: { w: 1080, aspect: "1080 / 820", pad: "1.4%", outer: "4.2% / 5.4%", inner: "3% / 4%", shadow: "0 0 0 1.5px var(--color-bezel-edge), 0 40px 90px rgba(0,0,0,0.55)" },
  tabletop: { w: 820, aspect: "820 / 1080", pad: "2%", outer: "6% / 4.6%", inner: "4% / 3%", shadow: "0 0 0 1.5px var(--color-bezel-edge), 0 40px 90px rgba(0,0,0,0.55)" },
  phone: { w: 390, aspect: "390 / 844", pad: "3.2%", outer: "13% / 6.2%", inner: "10.5% / 4.9%", shadow: "0 0 0 1.5px var(--color-bezel-edge), 0 30px 70px rgba(0,0,0,0.5)" },
};

/** Device bezel around a screen. The screen is a size container of the device's design width. */
export function Device({ kind, label, className = "", style, children }: { kind: Kind; label: string; className?: string; style?: CSSProperties; children: ReactNode }) {
  const f = FRAMES[kind];
  return (
    <div role="img" aria-label={label} className={`bg-bezel ${className}`} style={{ padding: f.pad, borderRadius: f.outer, boxShadow: f.shadow, ...style }}>
      <div className="screen relative w-full overflow-hidden bg-bg" style={{ aspectRatio: f.aspect, borderRadius: f.inner, ["--w" as string]: f.w }}>
        <div aria-hidden="true" className="absolute inset-0 text-fg" style={{ fontSize: u(16) }}>
          {children}
        </div>
        {kind === "duo" && (
          <div aria-hidden="true" className="absolute top-0 bottom-0 left-1/2 w-0.5" style={{ background: "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(0,0,0,0.3))" }} />
        )}
      </div>
    </div>
  );
}

function Frame({ src, className = "", style }: { src: string; className?: string; style?: CSSProperties }) {
  return <img src={src} alt="" width={1280} height={720} className={`block w-full object-cover ${className}`} style={{ aspectRatio: "16 / 9", ...style }} />;
}

function Bar({ w, h = 10, className = "bg-secondary" }: { w: number | string; h?: number; className?: string }) {
  return <div className={className} style={{ width: typeof w === "number" ? u(w) : w, height: u(h), borderRadius: u(h / 2) }} />;
}

function Progress({ pct, h = 4 }: { pct: number; h?: number }) {
  return (
    <div className="w-full bg-border" style={{ height: u(h), borderRadius: u(h) }}>
      <div className="h-full bg-brand" style={{ width: `${pct}%`, borderRadius: u(h) }} />
    </div>
  );
}

function PlayIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: u(size), height: u(size) }}>
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  );
}

function Controls({ size = 1 }: { size?: number }) {
  const s = (n: number) => u(n * size);
  return (
    <div className="flex items-center justify-center" style={{ gap: s(40) }}>
      <svg viewBox="0 0 24 24" style={{ width: s(28), height: s(28) }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M11 7 6 12l5 5M18 7l-5 5 5 5" />
      </svg>
      <div className="flex items-center justify-center rounded-full bg-brand text-brand-fg" style={{ width: s(64), height: s(64) }}>
        <svg viewBox="0 0 24 24" style={{ width: s(28), height: s(28) }}>
          <path fill="currentColor" d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
        </svg>
      </div>
      <svg viewBox="0 0 24 24" style={{ width: s(28), height: s(28) }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="m13 7 5 5-5 5M6 7l5 5-5 5" />
      </svg>
    </div>
  );
}

function EpisodeHeading({ titleSize = 22, gap = 4 }: { titleSize?: number; gap?: number }) {
  return (
    <div className="flex flex-col" style={{ gap: u(gap) }}>
      <div className="font-semibold text-brand" style={{ fontSize: u(titleSize * 0.6) }}>
        Episode 1 of {BOOK.episodes}
      </div>
      <div className="font-display font-bold leading-tight" style={{ fontSize: u(titleSize) }}>
        {CHAPTERS[0]}
      </div>
      <div className="text-muted" style={{ fontSize: u(titleSize * 0.6) }}>
        {BOOK.title} · {BOOK.author}
      </div>
    </div>
  );
}

function Transcript({ size = 16, extra = 4 }: { size?: number; extra?: number }) {
  return (
    <div className="flex flex-col" style={{ gap: u(size * 0.5) }}>
      {LINES.map((l) => (
        <div
          key={l.t}
          className={`flex ${l.current ? "bg-card font-semibold text-fg" : "text-muted"}`}
          style={{ gap: u(size * 0.75), padding: u(size * 0.6), borderRadius: u(size * 0.75), fontSize: u(size), lineHeight: 1.45 }}
        >
          <span className={`shrink-0 tabular-nums ${l.current ? "text-brand" : ""}`}>{l.t}</span>
          <span>{l.text}</span>
        </div>
      ))}
      {Array.from({ length: extra }, (_, i) => (
        <div key={i} className="flex flex-col" style={{ gap: u(size * 0.45), padding: u(size * 0.6), paddingLeft: u(size * 3.4) }}>
          <Bar w="100%" h={size * 0.55} />
          <Bar w={`${60 + ((i * 17) % 35)}%`} h={size * 0.55} />
        </div>
      ))}
    </div>
  );
}

/** iPhone Duo, open: a series page (hero) */
export function DuoSeriesScreen() {
  return (
    <div className="grid h-full grid-cols-2">
      <div className="flex flex-col" style={{ padding: u(36), gap: u(22) }}>
        <Frame src="/images/stage.jpg" style={{ borderRadius: u(16) }} />
        <div className="flex flex-col" style={{ gap: u(8) }}>
          <div className="font-semibold text-brand" style={{ fontSize: u(15) }}>
            Productivity · {BOOK.episodes} episodes · 1 hr
          </div>
          <div className="font-display font-bold leading-tight" style={{ fontSize: u(34) }}>
            {BOOK.title}
          </div>
          <div className="text-muted" style={{ fontSize: u(17) }}>
            {BOOK.author}
          </div>
        </div>
        <div className="flex items-center justify-center rounded-full bg-brand font-semibold text-brand-fg" style={{ height: u(56), gap: u(10), fontSize: u(18) }}>
          <PlayIcon size={22} />
          Play episode 1
        </div>
      </div>
      <div className="flex flex-col border-l border-border" style={{ padding: u(36), gap: u(10) }}>
        <div className="font-display font-bold" style={{ fontSize: u(22), marginBottom: u(6) }}>
          Episodes
        </div>
        {CHAPTERS.map((c, i) => (
          <div key={c} className={`flex items-center ${i === 0 ? "bg-card" : ""}`} style={{ gap: u(16), padding: u(12), borderRadius: u(14) }}>
            <div className="flex shrink-0 items-center justify-center rounded-full bg-secondary font-display font-bold text-brand" style={{ width: u(40), height: u(40), fontSize: u(16) }}>
              {i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold" style={{ fontSize: u(17) }}>
                {c}
              </div>
              <div className="text-faint" style={{ fontSize: u(14) }}>
                5 min{i >= 3 ? " · Premium" : ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** iPhone Duo, open: the player with the transcript beside it */
export function DuoPlayerScreen() {
  return (
    <div className="grid h-full grid-cols-2">
      <div className="flex flex-col justify-center" style={{ padding: u(36), gap: u(26) }}>
        <Frame src="/images/stage.jpg" style={{ borderRadius: u(16) }} />
        <EpisodeHeading titleSize={30} gap={6} />
        <div className="flex flex-col" style={{ gap: u(8) }}>
          <Progress pct={35} h={5} />
          <div className="flex justify-between text-faint tabular-nums" style={{ fontSize: u(13) }}>
            <span>0:08</span>
            <span>5:12</span>
          </div>
        </div>
        <Controls />
      </div>
      <div className="flex flex-col border-l border-border" style={{ padding: u(36), gap: u(14) }}>
        <div className="font-display font-bold" style={{ fontSize: u(22) }}>
          Transcript
        </div>
        <Transcript size={18} extra={5} />
      </div>
    </div>
  );
}

/** iPhone Duo, half folded: video above the fold, controls below */
export function DuoTabletopScreen() {
  return (
    <div className="grid h-full grid-rows-2">
      <div className="flex items-center bg-black" style={{ padding: u(32) }}>
        <Frame src="/images/headline.jpg" style={{ borderRadius: u(14) }} />
      </div>
      <div className="flex flex-col justify-center border-t-2 border-black/40" style={{ padding: u(44), gap: u(30) }}>
        <EpisodeHeading titleSize={34} gap={6} />
        <div className="flex flex-col" style={{ gap: u(10) }}>
          <Progress pct={58} h={6} />
          <div className="flex justify-between text-faint tabular-nums" style={{ fontSize: u(16) }}>
            <span>3:01</span>
            <span>5:12</span>
          </div>
        </div>
        <Controls size={1.3} />
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between font-semibold" style={{ padding: `${u(16)} ${u(30)} 0`, height: u(54), fontSize: u(15) }}>
      <span>9:41</span>
      <div className="rounded-full bg-black" style={{ width: u(120), height: u(34) }} />
      <span className="flex" style={{ gap: u(5) }}>
        <Bar w={18} h={11} className="bg-fg" />
        <Bar w={24} h={11} className="bg-fg" />
      </span>
    </div>
  );
}

function PhoneScreen({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ padding: `${u(12)} ${u(20)}`, gap: u(20) }}>
        {children}
      </div>
    </div>
  );
}

/** iPhone: browsing books */
export function PhoneBrowseScreen() {
  const topics = ["For you", "Finance", "Psychology", "History"];
  const shelf = ["/images/headline.jpg", "/images/versus.jpg", "/images/takeaways.jpg"];
  return (
    <PhoneScreen>
      <div className="font-display font-bold" style={{ fontSize: u(28) }}>
        mintsy<span className="text-brand">.</span>
      </div>
      <div className="flex items-center rounded-full bg-secondary text-faint" style={{ height: u(44), padding: `0 ${u(16)}`, gap: u(10), fontSize: u(15) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: u(18), height: u(18) }}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        Search books and episodes
      </div>
      <div className="flex" style={{ gap: u(8) }}>
        {topics.map((t, i) => (
          <div key={t} className={`rounded-full font-semibold ${i === 0 ? "bg-brand text-brand-fg" : "bg-secondary text-soft"}`} style={{ padding: `${u(7)} ${u(14)}`, fontSize: u(13) }}>
            {t}
          </div>
        ))}
      </div>
      <div className="flex flex-col" style={{ gap: u(10) }}>
        <div className="font-display font-bold" style={{ fontSize: u(19) }}>
          Continue watching
        </div>
        <div className="overflow-hidden bg-card" style={{ borderRadius: u(16) }}>
          <Frame src="/images/stage.jpg" />
          <div className="flex flex-col" style={{ padding: u(14), gap: u(6) }}>
            <div className="font-semibold" style={{ fontSize: u(16) }}>
              {CHAPTERS[0]}
            </div>
            <div className="text-muted" style={{ fontSize: u(13) }}>
              {BOOK.title} · Episode 1 of {BOOK.episodes}
            </div>
            <Progress pct={35} />
          </div>
        </div>
      </div>
      <div className="flex flex-col" style={{ gap: u(10) }}>
        <div className="font-display font-bold" style={{ fontSize: u(19) }}>
          Popular series
        </div>
        <div className="grid grid-cols-2" style={{ gap: u(12) }}>
          {shelf.slice(0, 2).map((s) => (
            <div key={s} className="flex flex-col" style={{ gap: u(8) }}>
              <Frame src={s} style={{ borderRadius: u(12) }} />
              <Bar w="85%" h={10} />
              <Bar w="55%" h={8} />
            </div>
          ))}
        </div>
      </div>
    </PhoneScreen>
  );
}

/** iPhone: the player */
export function PhonePlayerScreen() {
  return (
    <div className="flex h-full flex-col">
      <StatusBar />
      <Frame src="/images/stage.jpg" style={{ marginTop: u(8) }} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ padding: `${u(18)} ${u(20)}`, gap: u(18) }}>
        <EpisodeHeading titleSize={24} />
        <Progress pct={35} />
        <Controls size={0.8} />
        <Transcript size={14} extra={3} />
      </div>
    </div>
  );
}

/** iPhone: reading the transcript */
export function PhoneReaderScreen() {
  return (
    <PhoneScreen>
      <div className="flex items-center" style={{ gap: u(12) }}>
        <Frame src="/images/stage.jpg" className="shrink-0" style={{ width: u(96), borderRadius: u(8) }} />
        <div className="min-w-0">
          <div className="truncate font-display font-bold" style={{ fontSize: u(18) }}>
            {CHAPTERS[0]}
          </div>
          <div className="text-muted" style={{ fontSize: u(13) }}>
            Episode 1 · 0:08 / 5:12
          </div>
        </div>
      </div>
      <div className="flex" style={{ gap: u(8) }}>
        {["Transcript", "Takeaways"].map((t, i) => (
          <div key={t} className={`rounded-full font-semibold ${i === 0 ? "bg-fg text-bg" : "bg-secondary text-soft"}`} style={{ padding: `${u(7)} ${u(14)}`, fontSize: u(13) }}>
            {t}
          </div>
        ))}
      </div>
      <Transcript size={16} extra={7} />
    </PhoneScreen>
  );
}
