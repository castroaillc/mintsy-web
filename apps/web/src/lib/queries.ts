/**
 * GraphQL documents. Field names and shapes follow mobile-app/src/lib/catalog.tsx, saved.tsx and premium.tsx;
 * the progress fields are from backend branch feat/web-progress.
 */

const EPISODE_LIST_FIELDS = `
  id
  number
  title
  summary
  durationSec
  thumbnailUrl
  locked
`;

/** The whole catalog without transcripts or video URLs (Home, categories, My List). */
export const CATALOG_QUERY = `#graphql
  query Catalog {
    books {
      id
      title
      author
      category
      coverTone
      tint
      description
      episodes { ${EPISODE_LIST_FIELDS} }
    }
  }
`;

/** One book with everything the series page, player and transcript need. Video URLs are signed: refetch. */
export const BOOK_QUERY = `#graphql
  query Book($id: ID!) {
    book(id: $id) {
      id
      title
      author
      category
      coverTone
      tint
      description
      keyIdeas
      episodes {
        ${EPISODE_LIST_FIELDS}
        transcript { startSec text }
        takeaways
        videoUrl
      }
    }
  }
`;

/** For page metadata: no viewer-specific fields. */
export const BOOK_META_QUERY = `#graphql
  query BookMeta($id: ID!) {
    book(id: $id) { id title author category description episodes { id thumbnailUrl } }
  }
`;

export const ME_QUERY = `#graphql
  query Me {
    me {
      id
      email
      name
      image
      premium { active expiresAt willRenew periodType productId store }
      savedBookIds
      savedEpisodeIds
    }
  }
`;

const PROGRESS_FIELDS = `
  episodeId
  bookId
  episodeNumber
  positionSec
  durationSec
  completed
  updatedAt
`;

export const CONTINUE_QUERY = `#graphql
  query ContinueWatching($limit: Int) {
    me {
      continueWatching(limit: $limit) {
        ${PROGRESS_FIELDS}
        episode { id number title durationSec thumbnailUrl locked }
      }
      finishedBookIds
    }
  }
`;

export const BOOK_PROGRESS_QUERY = `#graphql
  query BookProgress($bookId: ID!) {
    me { progress(bookId: $bookId) { ${PROGRESS_FIELDS} } }
  }
`;

/** `progress(bookId)` for several books at once (My List › Finished dates), with aliases b0, b1, … */
export function finishedDatesQuery(bookIds: string[]) {
  const fields = bookIds.map((_, i) => `b${i}: progress(bookId: $b${i}) { updatedAt }`).join("\n");
  const vars = bookIds.map((_, i) => `$b${i}: ID!`).join(", ");
  return `query FinishedDates(${vars}) { me { ${fields} } }`;
}

export const SEARCH_QUERY = `#graphql
  query Search($query: String!) {
    search(query: $query) {
      books { id title author category coverTone tint description episodes { id number durationSec locked } }
      episodes {
        id
        bookId
        bookTitle
        episodeId
        episodeNumber
        episodeTitle
        episode { id number title durationSec thumbnailUrl locked }
        startSec
        snippet
        matchStart
        matchLength
      }
    }
  }
`;

export const SET_SAVED_MUTATION = `#graphql
  mutation SetSaved($kind: SavedKind!, $id: ID!, $saved: Boolean!) {
    setSaved(kind: $kind, id: $id, saved: $saved) { savedBookIds savedEpisodeIds }
  }
`;

export const SET_PROGRESS_MUTATION = `#graphql
  mutation SetProgress($episodeId: ID!, $positionSec: Int!, $completed: Boolean) {
    setProgress(episodeId: $episodeId, positionSec: $positionSec, completed: $completed) { ${PROGRESS_FIELDS} }
  }
`;

export const REFRESH_PREMIUM_MUTATION = `#graphql
  mutation RefreshPremium {
    refreshPremium { active expiresAt willRenew periodType productId store }
  }
`;
