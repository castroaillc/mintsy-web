import { INTEREST_CATEGORY, type Interest } from '@/data/interests';
import { BOOKS, type Book } from '@/data/mock';

export type Recommendation = { book: Book; reason: string };

/** Up to `count` books: one per picked interest's category, then popular titles. */
export function recommendForInterests(interests: Interest[], count = 3): Recommendation[] {
  const picks: Recommendation[] = [];
  for (const interest of interests) {
    const book = BOOKS.find(
      (b) => b.category === INTEREST_CATEGORY[interest] && !picks.some((p) => p.book === b),
    );
    if (book) picks.push({ book, reason: `Because you picked ${interest}` });
    if (picks.length === count) return picks;
  }
  for (const book of BOOKS) {
    if (picks.length === count) break;
    if (!picks.some((p) => p.book === book)) picks.push({ book, reason: 'Popular on mintsy' });
  }
  return picks;
}
