/**
 * The catalog query text. No imports, so scripts/hls-flag.test.mjs can check it under plain Node.
 *
 * `Episode.hlsUrl` is only in the text when asked for: a backend without the field rejects the whole request at
 * validation, even behind `@include`, and the viewer would lose the entire catalog.
 */
export function booksQuery(hlsEnabled: boolean) {
  return `#graphql
  query Books {
    books {
      id
      title
      author
      category
      coverTone
      coverUrl
      tint
      description
      episodes {
        id
        number
        title
        summary
        durationSec
        transcript { startSec text }
        takeaways
        videoUrl
${hlsEnabled ? '        hlsUrl\n' : ''}        thumbnailUrl
        locked
      }
    }
  }
`;
}

/**
 * Older backends lack newer fields: `Episode.locked` (pre-Premium; the app then decides locks itself)
 * and `Book.coverUrl` (pre-covers; tiles are drawn instead).
 */
export function legacyBooksQuery(query: string) {
  return query.replace(/^\s*locked\n/m, '').replace(/^\s*coverUrl\n/m, '');
}
