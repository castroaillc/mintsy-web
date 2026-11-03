/** Episodes 1..FREE_EPISODES of every book are free; later ones need Premium. */
export const FREE_EPISODES = 3;

/** The categories the app can filter by. A book in any other category never matches a chip. */
export const CATEGORIES = ["Finance", "Business", "Psychology", "Productivity", "History", "Health"];

export function isCategory(value) {
  return CATEGORIES.includes(value);
}
