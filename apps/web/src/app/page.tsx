import type { Metadata } from "next";
import { AppStoreBadge, WebAppButton } from "@/components/ctas";
import {
  Device,
  DuoPlayerScreen,
  DuoSeriesScreen,
  DuoTabletopScreen,
  PhoneBrowseScreen,
  PhonePlayerScreen,
  PhoneReaderScreen,
} from "@/components/mocks";
import { APP_STORE_URL } from "@/lib/config";
import { FREE_EPISODES, PRICING, WEB_APP_URL } from "@/site";

const title = "mintsy: finish the books you keep meaning to read";
const description =
  "mintsy turns every chapter into a short video episode with a full transcript. Get through a whole book a few minutes at a time.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: { title, description, url: "/" },
};

// Content from design/CoralLanding.dc.html (renderVals)
const facts = [
  { big: "5 min", label: "per episode" },
  { big: "1 : 1", label: "one episode for every chapter" },
  { big: "100%", label: "of episodes have a transcript" },
  { big: `${FREE_EPISODES} free`, label: "episodes of every book" },
];

const steps = [
  {
    n: 1,
    title: "Pick a book",
    body: "Browse by topic or search for the one on your list. Every series shows how many episodes it has and how long it takes.",
    screen: <PhoneBrowseScreen />,
    label: "The mintsy home screen: search, topics, continue watching and popular series",
  },
  {
    n: 2,
    title: "Watch an episode a day",
    body: "Each chapter becomes one 5-minute video. Set a daily goal and mintsy keeps your place.",
    screen: <PhonePlayerScreen />,
    label: "The mintsy player: the episode video, its progress and the synced transcript",
  },
  {
    n: 3,
    title: "Read along or skim",
    body: "Every episode has a full transcript and key takeaways. Tap any line to jump to that moment.",
    screen: <PhoneReaderScreen />,
    label: "The transcript reader, with the current line highlighted",
  },
];

const features = [
  { title: "Episode N of 20, always", body: "You always know where you are in a book and how much is left.", icon: "M4 6h16M4 12h10M4 18h7" },
  { title: "Full transcripts", body: "Read instead of watch, search inside a chapter, or copy a takeaway.", icon: "M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" },
  { title: "Daily goal and streak", body: "Pick 5, 15 or 30 minutes a day. A gentle reminder at the time you choose.", icon: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { title: "My List", body: "Save series for later and pick up exactly where you stopped.", icon: "M6 3h12v18l-6-4-6 4z" },
  { title: "Offline downloads", body: "Premium episodes download for flights and subways.", icon: "M12 4v11M7 10l5 5 5-5M5 20h14" },
  { title: "Up next, automatically", body: "When an episode ends, the next one is ready. Or stop there and come back tomorrow.", icon: "M5 5l10 7-10 7zM19 5v14" },
];

// "Start with a series" stays hidden until there are licensed, published launch titles to list.
const books: { title: string; author: string; eps: number; topic: string; bg: string; fg: string }[] = [];

const freeList = [`First ${FREE_EPISODES} episodes of every book`, "Transcripts for those episodes", "Daily goal, streak and reminders", "My List"];
const premiumList = ["Every episode of every book", "Full transcripts and key takeaways", "Offline downloads", "New series as they’re added", "Cancel anytime in Settings"];

const faqs = [
  { q: "What is a mintsy series?", a: "A book, turned into a set of short video episodes: one per chapter, about 5 minutes each, with a full transcript you can read along with." },
  { q: "What do I get for free?", a: `The first ${FREE_EPISODES} episodes of every book, with their transcripts. You can try as many series as you like before deciding on Premium.` },
  { q: "What does Premium add?", a: "Every episode of every book, full transcripts and key takeaways, offline downloads, and new series as they’re added." },
  { q: "Does it work on iPhone Duo?", a: "Yes. Open, you get two panes: the video and the transcript side by side. Half-folded in tabletop mode, the video sits on top and the controls stay below the fold." },
  { q: "Can I watch offline?", a: "Premium members can download episodes to watch on flights and commutes without a connection." },
  { q: "How do I cancel?", a: "Any time in your iPhone Settings, under your name, then Subscriptions. You keep Premium until the end of the period you paid for." },
];

const eyebrow = "text-[13px] font-semibold uppercase tracking-[1.2px] text-brand";
const h2 = "h2 m-0 font-display font-bold leading-[1.05] tracking-[-0.02em] text-balance";
const wrap = "mx-auto box-border max-w-[1240px] px-6";

function Check({ stroke }: { stroke: string }) {
  return (
    <svg className="mt-[3px] flex-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section id="top" className={`relative ${wrap} pt-10 pb-24`}>
        <div
          aria-hidden="true"
          className="absolute top-0 -right-[10%] aspect-square w-[70%] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(255,107,87,0.22), rgba(255,107,87,0))" }}
        />
        <div className="relative flex flex-wrap items-center gap-x-12 gap-y-14">
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-6">
            <div className="self-start rounded-full border border-border-strong px-3 py-[7px] text-[13px] font-semibold text-soft">Books, as 5‑minute video series</div>
            <h1 className="h1 m-0 font-display leading-none font-bold tracking-[-0.03em] text-balance">Finish the books you keep meaning to read.</h1>
            <p className="m-0 max-w-[520px] text-[19px] leading-[1.55] text-pretty text-body">
              mintsy turns every chapter into a short video episode with a full transcript. Watch one on your commute, read along at your desk, and get through a whole book
              a few minutes at a time.
            </p>
            <div id="download" className="flex scroll-mt-6 flex-wrap items-center gap-x-5 gap-y-3.5">
              <AppStoreBadge />
              <WebAppButton />
              <span className="text-[15px] text-muted">First {FREE_EPISODES} episodes of every book are free.</span>
            </div>
          </div>

          <div className="relative min-w-0 flex-[1.7_1_560px]">
            <Device kind="duo" label="A mintsy series open on iPhone Duo: the book and its first episode on the left, the episode list on the right">
              <DuoSeriesScreen />
            </Device>
            <div className="mt-3.5 text-center text-[13px] text-faint">Shown on iPhone Duo, open. Works on every iPhone.</div>
          </div>
        </div>
      </section>

      {/* At a glance */}
      <section aria-label="At a glance" className="border-y border-line bg-band">
        <div className={`${wrap} grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-x-8 gap-y-5 py-7`}>
          {facts.map((f) => (
            <div key={f.label} className="flex flex-col gap-1">
              <div className="font-display text-[30px] font-bold text-brand">{f.big}</div>
              <div className="text-[15px] text-body">{f.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={`${wrap} pt-[104px] pb-10`}>
        <div className="flex max-w-[720px] flex-col gap-3.5">
          <div className={eyebrow}>How it works</div>
          <h2 className={h2}>One chapter. One episode. Five minutes.</h2>
        </div>
        <ol className="mt-12 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-x-8 gap-y-12 p-0">
          {steps.map((st) => (
            <li key={st.n} className="flex flex-col gap-5">
              <Device kind="phone" label={st.label} className="w-[72%] max-w-[300px] self-center">
                {st.screen}
              </Device>
              <div className="flex gap-3.5">
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-line font-display font-bold text-brand">{st.n}</div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="mt-1 font-display text-[22px] font-bold">{st.title}</h3>
                  <p className="m-0 text-base leading-[1.55] text-muted">{st.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* iPhone Duo */}
      <section id="duo" className="mt-20" style={{ background: "linear-gradient(180deg, var(--color-bg) 0%, var(--color-duo-mid) 50%, var(--color-bg) 100%)" }}>
        <div className={`${wrap} py-24`}>
          <div className="flex max-w-[760px] flex-col gap-3.5">
            <div className={eyebrow}>Made for iPhone Duo</div>
            <h2 className={h2}>Unfold it and the book opens up.</h2>
            <p className="m-0 text-lg leading-[1.55] text-pretty text-body">
              Open, you get the video and the transcript side by side. Half-folded on a table, the video sits up top and the controls stay below the fold.
            </p>
          </div>
          <div className="mt-14 flex flex-wrap items-end gap-10">
            <figure className="m-0 flex min-w-0 flex-[2.2_1_520px] flex-col gap-3.5">
              <Device kind="duo" label="The mintsy player open on iPhone Duo: the episode video on the left, the synced transcript on the right">
                <DuoPlayerScreen />
              </Device>
              <figcaption className="text-[15px] text-muted">
                <b className="font-semibold text-fg">Open.</b> Watch on the left, read along on the right.
              </figcaption>
            </figure>
            <figure className="m-0 flex min-w-0 max-w-[380px] flex-[1_1_260px] flex-col gap-3.5">
              <Device kind="tabletop" label="The mintsy player on a half-folded iPhone Duo: the video on the top half, the controls on the bottom half">
                <DuoTabletopScreen />
              </Device>
              <figcaption className="text-[15px] text-muted">
                <b className="font-semibold text-fg">Tabletop.</b> Prop it up and watch hands-free.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className={`${wrap} py-24`}>
        <h2 className={`${h2} max-w-[720px]`}>Built for a few minutes a day.</h2>
        <div className="mt-11 grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
          {features.map((ft) => (
            <div key={ft.title} className="flex flex-col gap-2.5 rounded-[18px] border border-border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/12">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ft.icon} />
                </svg>
              </div>
              <h3 className="mt-1.5 font-display text-xl font-bold">{ft.title}</h3>
              <p className="m-0 text-[15px] leading-[1.55] text-muted">{ft.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Shelf */}
      {books.length > 0 && (
        <section aria-labelledby="shelf-h" className={`${wrap} pb-24`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="shelf-h" className="m-0 font-display text-[32px] font-bold">
              Start with a series
            </h2>
          </div>
          <ul className="mt-7 grid list-none grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-5 p-0">
            {books.map((b) => (
              <li key={b.title} className="flex flex-col gap-2.5">
                <div
                  className="box-border flex aspect-[2/3] flex-col justify-between rounded-lg px-3 py-3.5 shadow-[0_14px_30px_rgba(0,0,0,0.4)]"
                  style={{ background: b.bg, color: b.fg }}
                >
                  <div className="font-display text-lg leading-[1.08] font-bold">{b.title}</div>
                  <div className="text-[11px] font-medium">{b.author}</div>
                </div>
                <div className="text-sm text-muted">
                  {b.eps} episodes · {b.topic}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Pricing */}
      <section id="pricing" className="border-y border-line bg-band">
        <div className="mx-auto box-border max-w-[1040px] px-6 py-24">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <div className={eyebrow}>Pricing</div>
            <h2 className="h2 m-0 font-display leading-[1.05] font-bold tracking-[-0.02em]">Start free. Upgrade when you’re hooked.</h2>
          </div>
          <div className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5">
            <div className="flex flex-col gap-[18px] rounded-[22px] border border-border bg-card p-8">
              <h3 className="font-display text-2xl font-bold">Free</h3>
              <div className="font-display text-[44px] leading-none font-bold">$0</div>
              <ul className="m-0 flex list-none flex-col gap-[18px] p-0">
                {freeList.map((li) => (
                  <li key={li} className="flex gap-2.5 text-base leading-[1.45] text-soft">
                    <Check stroke="var(--color-faint)" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3">
                {APP_STORE_URL ? (
                  <a href={APP_STORE_URL} className="flex h-[52px] items-center justify-center rounded-[14px] border border-border-strong text-base font-semibold hover:border-ring">
                    Download free
                  </a>
                ) : (
                  <div className="flex h-[52px] items-center justify-center rounded-[14px] border border-border-strong text-base font-semibold text-muted">App Store: coming soon</div>
                )}
                {WEB_APP_URL && (
                  <a href={WEB_APP_URL} className="text-center text-[15px] font-semibold text-muted underline-offset-2 hover:text-fg hover:underline">
                    Or watch on the web
                  </a>
                )}
              </div>
            </div>
            <div className="relative flex flex-col gap-[18px] rounded-[22px] border-2 border-brand bg-premium p-8">
              {PRICING && <div className="absolute -top-3.5 right-6 rounded-full bg-brand px-3 py-[5px] text-xs font-bold tracking-[0.5px] text-brand-fg">{PRICING.trialLength} FREE TRIAL</div>}
              <h3 className="font-display text-2xl font-bold">Premium</h3>
              {PRICING ? (
                <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1.5">
                  <span className="font-display text-[44px] leading-none font-bold">{PRICING.yearly}</span>
                  <span className="text-[15px] text-muted">a year, or {PRICING.monthly} a month</span>
                </div>
              ) : (
                <div className="text-[15px] leading-normal text-muted">Yearly or monthly. Prices are shown in the app.</div>
              )}
              <ul className="m-0 flex list-none flex-col gap-[18px] p-0">
                {premiumList.map((li) => (
                  <li key={li} className="flex gap-2.5 text-base leading-[1.45] text-fg">
                    <Check stroke="var(--color-brand)" />
                    <span>{li}</span>
                  </li>
                ))}
              </ul>
              {APP_STORE_URL ? (
                <a href={APP_STORE_URL} className="mt-auto flex h-[52px] items-center justify-center rounded-[14px] bg-brand text-base font-bold text-brand-fg hover:bg-brand-hover">
                  {PRICING ? "Start your free trial in the app" : "Get Premium in the app"}
                </a>
              ) : (
                <div className="mt-auto flex h-[52px] items-center justify-center rounded-[14px] border border-brand text-base font-bold text-fg">App Store: coming soon</div>
              )}
            </div>
          </div>
          <p className="mt-5 mb-0 text-center text-[13px] leading-normal text-faint">
            Subscriptions are billed through your Apple ID and renew automatically until canceled in Settings. Prices may vary by country.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto box-border max-w-[820px] px-6 py-24">
        <h2 className="h2 m-0 mb-8 font-display leading-[1.05] font-bold tracking-[-0.02em]">Questions</h2>
        {faqs.map((f, i) => (
          <details key={f.q} name="faq" open={i === 0} className="faq border-t border-border">
            <summary className="flex w-full cursor-pointer items-center justify-between gap-4 py-[22px] text-left text-lg font-semibold text-fg hover:text-white">
              <span>{f.q}</span>
              <span aria-hidden="true" className="sign flex-none text-2xl font-normal text-brand" />
            </summary>
            <p className="faq-a -mt-1.5 mb-[22px] max-w-[680px] text-base leading-[1.6] text-muted">{f.a}</p>
          </details>
        ))}
      </section>

      {/* Final call to action */}
      <section className={`${wrap} pb-24`}>
        <div className="relative flex flex-wrap items-center justify-between gap-7 overflow-hidden rounded-[28px] bg-brand text-brand-fg" style={{ padding: "clamp(36px, 6cqi, 72px)" }}>
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3">
            <h2 className="h2 m-0 font-display leading-[1.02] font-bold tracking-[-0.02em] text-balance">Your next book is five minutes away.</h2>
            <p className="m-0 text-lg leading-normal text-on-brand-muted">Free to download. The first {FREE_EPISODES} episodes of every book are on us.</p>
          </div>
          <div className="flex flex-wrap gap-3.5">
            <AppStoreBadge bordered={false} />
            <WebAppButton tone="brand" />
          </div>
        </div>
      </section>
    </>
  );
}
