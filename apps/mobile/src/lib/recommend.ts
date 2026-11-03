import { INTEREST_CATEGORY, type Interest } from '@/data/interests';
import type { Book } from '@/data/types';

export type Recommendation = { book: Book; reason: string };

/** Up to `count` books: one per picked interest's category, then the rest of the catalog in order. */
export function recommendForInterests(books: Book[], interests: Interest[], count = 3): Recommendation[] {
  const picks: Recommendation[] = [];
  for (const interest of interests) {
    const book = books.find(
      (b) => b.category === INTEREST_CATEGORY[interest] && !picks.some((p) => p.book === b),
    );
    if (book) picks.push({ book, reason: `Because you picked ${interest}` });
    if (picks.length === count) return picks;
  }
  for (const book of books) {
    if (picks.length === count) break;
    if (!picks.some((p) => p.book === book)) picks.push({ book, reason: 'From the catalog' });
  }
  return picks;
}
