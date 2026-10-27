/** In-memory catalog for the frontend. Tones are cover/thumbnail art colors, not theme colors. */

export type TranscriptLine = { startSec: number; text: string };

export type Episode = {
  id: string;
  number: number;
  title: string;
  summary: string;
  durationSec: number;
  transcript: TranscriptLine[];
  takeaways: string[];
};

export type Category = 'Finance' | 'Business' | 'Psychology' | 'Productivity' | 'History' | 'Health';

export type Book = {
  id: string;
  title: string;
  author: string;
  category: Category;
  /** Solid background of the generated cover tile. */
  coverTone: string;
  /** Darker tint for hero backdrops and the player panel. */
  tint: string;
  description: string;
  episodes: Episode[];
};

export type EpisodeProgress = { positionSec: number; completed: boolean };
export type ProgressMap = Record<string, EpisodeProgress>;

export const CATEGORIES = ['All', 'Finance', 'Business', 'Psychology', 'Productivity', 'History', 'Health'] as const;
export type CategoryFilter = (typeof CATEGORIES)[number];

/** Rotating thumbnail tints for episode cards. */
export const EPISODE_TINTS = ['#24382F', '#2C3245', '#3B3426', '#3A2B30'];

type ChapterSeed = {
  title: string;
  summary: string;
  /** "m:ss" */
  duration: string;
  transcript?: [number, string][];
  takeaways?: string[];
};

function parseDuration(value: string) {
  const [m, s] = value.split(':').map(Number);
  return m * 60 + s;
}

/** Placeholder lines spread evenly across the episode, used until real transcripts exist. */
function placeholderTranscript(seed: ChapterSeed, durationSec: number): TranscriptLine[] {
  const texts = [
    `This episode covers "${seed.title}".`,
    seed.summary,
    'Start with the story the chapter opens on, and why it sticks.',
    'The core idea is simple to state and harder to live by.',
    'Most people get this wrong for understandable reasons.',
    'Here is the example the author keeps coming back to.',
    'Notice how small, repeated choices add up over time.',
    'The practical question is what you would do differently tomorrow.',
    'To recap: keep the idea simple and the habit consistent.',
  ];
  const step = Math.floor(durationSec / texts.length);
  return texts.map((text, i) => ({ startSec: i * step, text }));
}

function buildEpisodes(bookId: string, seeds: ChapterSeed[]): Episode[] {
  return seeds.map((seed, i) => {
    const durationSec = parseDuration(seed.duration);
    return {
      id: `${bookId}-${i + 1}`,
      number: i + 1,
      title: seed.title,
      summary: seed.summary,
      durationSec,
      transcript: seed.transcript
        ? seed.transcript.map(([startSec, text]) => ({ startSec, text }))
        : placeholderTranscript(seed, durationSec),
      takeaways: seed.takeaways ?? [
        seed.summary,
        'Look for where this already shows up in your own decisions.',
        'Pick one small change and keep it going long enough to compound.',
      ],
    };
  });
}

const psychologyOfMoney: ChapterSeed[] = [
  {
    title: 'No One’s Crazy',
    summary: 'Your money habits come from your own experiences, which is why everyone’s choices make sense to them.',
    duration: '4:52',
    transcript: [
      [0, 'People do some crazy things with money. But no one is actually crazy.'],
      [33, 'Each of us has a different set of experiences that shapes how the world works.'],
      [66, 'Someone who grew up during high inflation sees risk very differently from someone who didn’t.'],
      [98, 'What you lived through counts for more than what you read about.'],
      [131, 'That is why two smart people can look at the same market and disagree.'],
      [163, 'Retirement saving, index funds and credit cards are all newer than they feel.'],
      [196, 'We are all still new to this, and learning as we go.'],
      [229, 'So the next decision that looks crazy probably makes sense to the person making it.'],
      [261, 'Takeaway: start from empathy. Everyone is working from their own story.'],
    ],
  },
  { title: 'Luck & Risk', summary: 'Results are never just effort. Luck and risk shape outcomes more than we like to admit.', duration: '5:06' },
  { title: 'Never Enough', summary: 'Knowing when to stop wanting more may be the hardest financial skill of all.', duration: '4:48' },
  {
    title: 'Confounding Compounding',
    summary: 'Modest returns held for a very long time beat big returns you can’t sustain.',
    duration: '5:12',
    transcript: [
      [0, 'Compounding is easy to explain and hard to feel. Our instincts expect growth in straight lines.'],
      [38, 'But growth that builds on itself curves upward, and most of the curve shows up late.'],
      [75, 'In a long investing life, the biggest gains usually arrive in the final decades, not the first.'],
      [112, 'That makes time the variable people underrate the most.'],
      [124, 'Many investors chase the highest possible return. This chapter argues for a different target.'],
      [161, 'Aim for good returns you can stay with, through downturns, boredom and the urge to tinker.'],
      [200, 'Quitting early is the most expensive mistake, because it resets the clock compounding depends on.'],
      [242, 'The same idea reaches beyond money. Skills, relationships and reputation compound too.'],
      [275, 'Takeaway: protect the streak. Staying in the game is the strategy.'],
    ],
    takeaways: [
      'Compounding rewards time far more than it rewards a high rate of return.',
      'Choose returns you can sustain for decades over returns you can’t live with.',
      'Avoid moves that interrupt the process. Staying invested is the edge.',
    ],
  },
  { title: 'Getting Wealthy vs. Staying Wealthy', summary: 'Getting rich takes risk. Staying rich takes humility, frugality and a little paranoia.', duration: '5:03' },
  { title: 'Tails, You Win', summary: 'A small number of outliers drive most results, in investing and in careers.', duration: '4:57' },
  { title: 'Freedom', summary: 'The highest dividend money pays is control over your own time.', duration: '4:41' },
  { title: 'Man in the Car Paradox', summary: 'People notice the car, not the driver. Wealth rarely earns the admiration we hope for.', duration: '4:55' },
  { title: 'Wealth Is What You Don’t See', summary: 'Being rich is income. Being wealthy is the money you chose not to spend.', duration: '5:01' },
  { title: 'Save Money', summary: 'You don’t need a reason to save. Savings buy options in a future you can’t predict.', duration: '4:50' },
  { title: 'Reasonable > Rational', summary: 'A plan you can actually stick with beats a perfect one you’ll abandon.', duration: '5:08' },
  { title: 'Surprise!', summary: 'History is a weak guide when the events that matter most have no precedent.', duration: '4:46' },
  { title: 'Room for Error', summary: 'Build in a margin of safety so the plan survives being wrong.', duration: '5:10' },
  { title: 'You’ll Change', summary: 'Your goals will shift over time, so avoid plans that lock in who you are today.', duration: '4:58' },
  { title: 'Nothing’s Free', summary: 'Volatility is the fee for market returns, not a fine for doing something wrong.', duration: '5:04' },
  { title: 'You & Me', summary: 'Be careful taking cues from people who are playing a different game than you.', duration: '4:53' },
  { title: 'The Seduction of Pessimism', summary: 'Pessimism sounds smarter than optimism, yet optimism tends to win over time.', duration: '5:00' },
  { title: 'When You’ll Believe Anything', summary: 'We are most easily convinced by the stories we need to be true.', duration: '4:49' },
  { title: 'All Together Now', summary: 'The book’s lessons condensed into a handful of practical rules.', duration: '5:14' },
  { title: 'Confessions', summary: 'How the author applies these ideas to his own money.', duration: '4:44' },
];

function book(meta: Omit<Book, 'episodes'>, seeds: ChapterSeed[]): Book {
  return { ...meta, episodes: buildEpisodes(meta.id, seeds) };
}

export const BOOKS: Book[] = [
  book(
    {
      id: 'psychology-of-money',
      title: 'The Psychology of Money',
      author: 'Morgan Housel',
      category: 'Finance',
      coverTone: '#E7DFCF',
      tint: '#24382F',
      description:
        'Why doing well with money has less to do with how smart you are and more to do with how you behave. Every chapter, distilled into a 5-minute episode with a full transcript.',
    },
    psychologyOfMoney,
  ),
  book(
    {
      id: 'intelligent-investor',
      title: 'The Intelligent Investor',
      author: 'Benjamin Graham',
      category: 'Finance',
      coverTone: '#1E3557',
      tint: '#1E3557',
      description: 'The classic case for value investing: protect the downside, ignore Mr. Market’s moods and buy with a margin of safety.',
    },
    [
      { title: 'Investment versus Speculation', summary: 'What separates an investor from a speculator, and why the line matters.', duration: '5:02' },
      { title: 'Inflation and You', summary: 'Why inflation quietly erodes returns and how to plan around it.', duration: '4:54' },
      { title: 'A Century of Stock-Market History', summary: 'What a hundred years of prices say about patience and price.', duration: '5:09' },
      { title: 'The Defensive Investor', summary: 'A simple, low-effort portfolio built to avoid serious mistakes.', duration: '4:47' },
      { title: 'The Enterprising Investor', summary: 'What it takes to do better than average, and what it costs.', duration: '5:05' },
      { title: 'Market Fluctuations', summary: 'Meet Mr. Market, the moody partner you can choose to ignore.', duration: '4:58' },
      { title: 'Stock Selection', summary: 'Practical tests for finding sound companies at fair prices.', duration: '5:11' },
      { title: 'Margin of Safety', summary: 'The one idea that ties the whole book together.', duration: '4:51' },
    ],
  ),
  book(
    {
      id: 'rich-dad-poor-dad',
      title: 'Rich Dad Poor Dad',
      author: 'Robert T. Kiyosaki',
      category: 'Finance',
      coverTone: '#5B2333',
      tint: '#5B2333',
      description: 'Two fathers, two views of money, and the case for building assets instead of working only for a paycheck.',
    },
    [
      { title: 'The Rich Don’t Work for Money', summary: 'Fear and desire drive most money decisions. Learn to see them.', duration: '4:56' },
      { title: 'Why Teach Financial Literacy?', summary: 'Know the difference between an asset and a liability.', duration: '5:03' },
      { title: 'Mind Your Own Business', summary: 'Build an asset column alongside your career.', duration: '4:49' },
      { title: 'The History of Taxes', summary: 'How the rules reward owners differently from employees.', duration: '5:07' },
      { title: 'The Rich Invent Money', summary: 'Financial skill turns opportunities into income.', duration: '4:52' },
      { title: 'Work to Learn', summary: 'Choose jobs for the skills they teach, not just the pay.', duration: '5:00' },
    ],
  ),
  book(
    {
      id: 'teach-you-to-be-rich',
      title: 'I Will Teach You to Be Rich',
      author: 'Ramit Sethi',
      category: 'Finance',
      coverTone: '#E2B34C',
      tint: '#4A3A17',
      description: 'A six-week, automate-everything plan for spending on what you love and cutting what you don’t.',
    },
    [
      { title: 'Optimize Your Credit Cards', summary: 'Use credit to build a strong score without paying interest.', duration: '4:45' },
      { title: 'Beat the Banks', summary: 'Pick accounts that work for you instead of against you.', duration: '4:59' },
      { title: 'Get Ready to Invest', summary: 'Open the right accounts before you pick a single fund.', duration: '5:06' },
      { title: 'Conscious Spending', summary: 'Spend extravagantly on what you love, cut mercilessly elsewhere.', duration: '5:13' },
      { title: 'Save While Sleeping', summary: 'Automate your money so good habits happen by default.', duration: '4:50' },
      { title: 'The Myth of Financial Expertise', summary: 'Why low-cost index funds beat most professionals.', duration: '5:01' },
    ],
  ),
  book(
    {
      id: 'common-sense-investing',
      title: 'The Little Book of Common Sense Investing',
      author: 'John C. Bogle',
      category: 'Finance',
      coverTone: '#2F4A3D',
      tint: '#2F4A3D',
      description: 'The founder of Vanguard makes the case for owning the whole market at the lowest possible cost.',
    },
    [
      { title: 'A Parable', summary: 'The Gotrocks family learns what middlemen really cost.', duration: '4:48' },
      { title: 'Rational Exuberance', summary: 'Long-run returns come from business results, not speculation.', duration: '5:04' },
      { title: 'Cast Your Lot with Business', summary: 'Owning every company captures the market’s return.', duration: '4:57' },
      { title: 'How Most Investors Turn a Winner’s Game into a Loser’s Game', summary: 'Costs and trading drag returns below the market.', duration: '5:10' },
      { title: 'Focus on the Lowest-Cost Funds', summary: 'Fees are the one thing you can control.', duration: '4:53' },
      { title: 'Asset Allocation', summary: 'Balance stocks and bonds for who you are and when you need it.', duration: '5:06' },
      { title: 'Investment Advice That Meets the Test of Time', summary: 'Simple rules that held up for decades.', duration: '4:59' },
    ],
  ),
  book(
    {
      id: 'thinking-fast-and-slow',
      title: 'Thinking, Fast and Slow',
      author: 'Daniel Kahneman',
      category: 'Psychology',
      coverTone: '#F0EEE9',
      tint: '#2C3245',
      description: 'Two systems run your mind: one fast and intuitive, one slow and deliberate. Learn where each leads you astray.',
    },
    [
      { title: 'The Characters of the Story', summary: 'Meet System 1 and System 2, and how they share the work.', duration: '5:05' },
      { title: 'Attention and Effort', summary: 'Why hard thinking is costly and the mind avoids it.', duration: '4:51' },
      { title: 'The Lazy Controller', summary: 'Self-control and careful thought draw on the same limited effort.', duration: '4:58' },
      { title: 'The Associative Machine', summary: 'One idea quietly primes the next.', duration: '5:07' },
      { title: 'Cognitive Ease', summary: 'Familiar feels true, and that is a trap.', duration: '4:46' },
      { title: 'Jumping to Conclusions', summary: 'What you see is all there is.', duration: '5:02' },
      { title: 'Anchors', summary: 'Arbitrary numbers bend our estimates.', duration: '4:55' },
      { title: 'The Illusion of Validity', summary: 'Confidence is a feeling, not evidence.', duration: '5:09' },
      { title: 'Loss Aversion', summary: 'Losses loom larger than equivalent gains.', duration: '4:49' },
      { title: 'Two Selves', summary: 'The experiencing self and the remembering self want different things.', duration: '5:12' },
    ],
  ),
  book(
    {
      id: 'atomic-habits',
      title: 'Atomic Habits',
      author: 'James Clear',
      category: 'Productivity',
      coverTone: '#C9D6CF',
      tint: '#24382F',
      description: 'Tiny changes, remarkable results. A practical system for building good habits and breaking bad ones.',
    },
    [
      { title: 'The Surprising Power of Atomic Habits', summary: 'Getting 1% better every day adds up to something big.', duration: '4:57' },
      { title: 'How Your Habits Shape Your Identity', summary: 'Focus on who you want to become, not what you want to achieve.', duration: '5:03' },
      { title: 'How to Build Better Habits in 4 Simple Steps', summary: 'Cue, craving, response and reward.', duration: '5:08' },
      { title: 'The Man Who Didn’t Look Right', summary: 'Habits run on cues we stop noticing.', duration: '4:44' },
      { title: 'The Best Way to Start a New Habit', summary: 'Implementation intentions and habit stacking.', duration: '4:52' },
      { title: 'Motivation Is Overrated', summary: 'Design your environment so the right choice is the easy one.', duration: '5:00' },
      { title: 'The Secret to Self-Control', summary: 'Disciplined people rely less on willpower than you think.', duration: '4:49' },
      { title: 'How to Make a Habit Irresistible', summary: 'Temptation bundling makes good habits attractive.', duration: '5:06' },
      { title: 'The Law of Least Effort', summary: 'Reduce friction for good habits, add it for bad ones.', duration: '4:54' },
      { title: 'The Two-Minute Rule', summary: 'Make it so easy you can’t say no.', duration: '4:41' },
      { title: 'How to Stick with Good Habits Every Day', summary: 'Track it and never miss twice.', duration: '5:10' },
      { title: 'The Goldilocks Rule', summary: 'Stay motivated by working at the edge of your ability.', duration: '5:02' },
    ],
  ),
  book(
    {
      id: 'lean-startup',
      title: 'The Lean Startup',
      author: 'Eric Ries',
      category: 'Business',
      coverTone: '#3A2F5B',
      tint: '#3A2F5B',
      description: 'Build, measure, learn: how to test ideas quickly and grow a business on evidence rather than guesswork.',
    },
    [
      { title: 'Start', summary: 'Entrepreneurship is a kind of management, not just a spark.', duration: '4:58' },
      { title: 'Define', summary: 'A startup is an institution built under extreme uncertainty.', duration: '5:04' },
      { title: 'Learn', summary: 'Validated learning is the real unit of progress.', duration: '4:50' },
      { title: 'Experiment', summary: 'Treat every plan as a set of testable hypotheses.', duration: '5:07' },
      { title: 'Leap', summary: 'Find the leap-of-faith assumptions and test them first.', duration: '4:53' },
      { title: 'Test', summary: 'Ship a minimum viable product to start learning.', duration: '5:01' },
      { title: 'Measure', summary: 'Innovation accounting keeps you honest about progress.', duration: '4:47' },
      { title: 'Pivot (or Persevere)', summary: 'Decide when to change course and when to stay on it.', duration: '5:13' },
    ],
  ),
  book(
    {
      id: 'deep-work',
      title: 'Deep Work',
      author: 'Cal Newport',
      category: 'Productivity',
      coverTone: '#B9542F',
      tint: '#4A2618',
      description: 'Focused, distraction-free work is rare and valuable. Here is how to train for it and build a life around it.',
    },
    [
      { title: 'Deep Work Is Valuable', summary: 'The ability to focus is becoming an economic superpower.', duration: '4:55' },
      { title: 'Deep Work Is Rare', summary: 'Busyness has become a proxy for productivity.', duration: '5:02' },
      { title: 'Deep Work Is Meaningful', summary: 'Absorbing work makes for a more satisfying life.', duration: '4:48' },
      { title: 'Work Deeply', summary: 'Rituals and routines that make focus automatic.', duration: '5:09' },
      { title: 'Embrace Boredom', summary: 'Train your attention by resisting constant novelty.', duration: '4:51' },
      { title: 'Quit Social Media', summary: 'Choose tools for their real benefit, not any benefit.', duration: '5:05' },
    ],
  ),
];

export const FEATURED_BOOK_ID = 'psychology-of-money';
export const NEW_THIS_WEEK_IDS = ['thinking-fast-and-slow', 'atomic-habits', 'lean-startup', 'deep-work'];

export function getBook(id: string) {
  return BOOKS.find((b) => b.id === id);
}

export function findEpisode(episodeId: string) {
  for (const b of BOOKS) {
    const episode = b.episodes.find((e) => e.id === episodeId);
    if (episode) return { book: b, episode };
  }
  return undefined;
}

function seedPartial(episodeId: string, fraction: number): [string, EpisodeProgress] {
  const found = findEpisode(episodeId);
  const positionSec = Math.round((found?.episode.durationSec ?? 0) * fraction);
  return [episodeId, { positionSec, completed: false }];
}

const watched = (episodeId: string): [string, EpisodeProgress] => [episodeId, { positionSec: 0, completed: true }];

export const INITIAL_PROGRESS: ProgressMap = Object.fromEntries([
  watched('psychology-of-money-1'),
  watched('psychology-of-money-2'),
  watched('psychology-of-money-3'),
  seedPartial('psychology-of-money-4', 0.4),
  watched('intelligent-investor-1'),
  seedPartial('intelligent-investor-2', 0.8),
  watched('rich-dad-poor-dad-1'),
  seedPartial('rich-dad-poor-dad-2', 0.2),
]);

/** Dark or light cover ink, whichever reads on the given tone. */
export function coverInk(tone: string) {
  const n = parseInt(tone.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return luma > 150 ? '#1C1C1C' : '#F4EFE6';
}
