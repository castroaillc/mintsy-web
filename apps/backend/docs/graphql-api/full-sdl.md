# Full SDL

The complete schema, printed from `typeDefs` in `src/graphql/schema.ts` with graphql-js `printSchema`. Descriptions are the schema's own.

{% hint style="info" %}
This page is generated, not hand-written. After a schema change, regenerate it as described in [Changing the schema](changing-the-schema.md#update-these-docs).
{% endhint %}

```graphql
type User {
  id: ID!
  email: String!
  name: String!
  emailVerified: Boolean!
  image: String

  """
  The user's mintsy Premium subscription (RevenueCat entitlement premium).
  """
  premium: Premium!

  """
  Book ids the user saved to My List, most recently saved first. May include ids no longer in the catalog: skip those.
  """
  savedBookIds: [ID!]!

  """
  Episode ids (<bookId>-<number>) the user saved, most recently saved first. May include ids no longer in the catalog.
  """
  savedEpisodeIds: [ID!]!

  """
  Continue watching: one entry per book, the book with the most recent activity first. Each is the book's
  most recently watched episode if it isn't completed, otherwise the next episode that isn't completed
  (positionSec 0 if never started). That next episode may be locked (episode.locked): show an upsell.
  Books where every published episode is completed are left out. limit: 0-50.
  """
  continueWatching(limit: Int = 10): [EpisodeProgress!]!

  """
  Every episode of the book with stored progress, by episode number. Empty if none.
  """
  progress(bookId: ID!): [EpisodeProgress!]!

  """
  Published books whose every published episode is completed, most recently finished first.
  """
  finishedBookIds: [ID!]!
}

"""The viewer's place in one episode."""
type EpisodeProgress {
  """Same as episodeId."""
  id: ID!

  """
  Episode id: <bookId>-<number> (the same ids as Episode.id and savedEpisodeIds).
  """
  episodeId: ID!
  bookId: ID!
  episodeNumber: Int!

  """Seconds watched, between 0 and durationSec."""
  positionSec: Int!

  """The episode's duration in seconds."""
  durationSec: Int!

  """
  Watched to the end: position reached 95% of the duration, or setProgress(completed: true).
  """
  completed: Boolean!

  """When this was last saved (ISO 8601, server time)."""
  updatedAt: String!

  """The episode, or null if it's no longer published."""
  episode: Episode

  """The book, or null if it's no longer published."""
  book: Book
}

enum SavedKind {
  BOOK
  EPISODE
}

type Premium {
  """
  True while the subscription (or trial) gives access; false once expiresAt has passed.
  """
  active: Boolean!

  """End of the current period (ISO 8601). Null if never subscribed."""
  expiresAt: String

  """False once the user cancelled or billing failed."""
  willRenew: Boolean!

  """
  RevenueCat period type, lowercased: trial, normal or intro. Null if never subscribed.
  """
  periodType: String

  """
  Store product id of the subscription, e.g. the yearly or monthly product.
  """
  productId: String

  """
  Where it was bought (lowercased RevenueCat store): app_store, rc_billing (web), stripe, play_store, promotional, ... Null if never subscribed. Manage the subscription where it was bought.
  """
  store: String
}

type TranscriptLine {
  startSec: Int!
  text: String!
}

type Episode {
  """Stable id: <bookId>-<number>"""
  id: ID!
  number: Int!
  title: String!
  summary: String!
  durationSec: Int!

  """Empty when locked."""
  transcript: [TranscriptLine!]!

  """Empty when locked."""
  takeaways: [String!]!

  """
  Progressive MP4; null until the episode's video is uploaded, and null when locked. May be a short-lived signed URL: refetch rather than storing it.
  """
  videoUrl: String
  thumbnailUrl: String

  """
  True when the viewer needs Premium to watch: number > 3 (FREE_EPISODES) and the viewer isn't Premium. Signed-out viewers are never Premium.
  """
  locked: Boolean!
}

type Book {
  id: ID!
  title: String!
  author: String!
  category: String!
  coverTone: String!
  tint: String!
  description: String!
  episodes: [Episode!]!

  """
  The book in 5 ideas (at most 5). Curated ideas when the book has them; otherwise the first takeaway of each episode the viewer can watch, in order, deduplicated (so at most 3 for free viewers). Can be empty.
  """
  keyIdeas: [String!]!
}

"""
Results of search(query). Both lists are empty for queries shorter than 2 characters.
"""
type SearchResult {
  """
  Books whose title, author or category contains the query: title matches first, then author, then category. At most 20.
  """
  books: [Book!]!

  """
  Transcript lines that mention the query: those from the matched books first, then the rest of the catalog, in episode and time order. At most 30, and at most 3 per episode. Locked episodes are not searched.
  """
  episodes: [EpisodeMatch!]!
}

"""One transcript line that mentions the search query."""
type EpisodeMatch {
  """Stable id: <bookId>-<number>-<startSec>"""
  id: ID!
  bookId: ID!
  bookTitle: String!

  """Episode id: <bookId>-<number>"""
  episodeId: ID!
  episodeNumber: Int!
  episodeTitle: String!

  """The full episode (thumbnail, duration, locked state)."""
  episode: Episode!

  """
  Start of the matching transcript line, in seconds: open the player here.
  """
  startSec: Int!

  """
  About 80-120 characters of the line around the match, with a leading/trailing … when cut.
  """
  snippet: String!

  """
  Offset of the match in snippet, in UTF-16 code units (JavaScript string indices).
  """
  matchStart: Int!

  """
  Length of the match in snippet, in UTF-16 code units. snippet.slice(matchStart, matchStart + matchLength) is the matched text.
  """
  matchLength: Int!
}

type Query {
  health: String!
  me: User

  """The catalog is public: the welcome screen shows it before sign-in."""
  books: [Book!]!
  book(id: ID!): Book

  """
  Public catalog search (works signed out) over book titles, authors, categories and episode transcripts. Case-insensitive; the query is trimmed and cut to 100 characters.
  """
  search(query: String!): SearchResult!
}

type Mutation {
  """Registers an Expo push token for the current user's device."""
  registerPushToken(token: String!, platform: String!): Boolean!

  """Removes a push token, e.g. when the user signs out on that device."""
  unregisterPushToken(token: String!): Boolean!

  """
  Sends a test push to all of the current user's devices. Returns the number of devices targeted.
  """
  sendTestPush: Int!

  """
  Refetches the current user's subscription from RevenueCat (call right after a purchase or restore), stores and returns it.
  """
  refreshPremium: Premium!

  """
  Saves (saved: true) or removes (saved: false) a book or episode in the viewer's My List. Idempotent; re-saving keeps the original position. At most 500 per kind. Returns the updated viewer.
  """
  setSaved(kind: SavedKind!, id: ID!, saved: Boolean!): User!

  """
  Saves the viewer's place in a published episode (idempotent; call every ~10 s while playing, and on
  pause, seek and exit). positionSec is clamped to [0, durationSec]. completed: true / false sets it
  (false = mark as not watched); omitted or null keeps it, and a position at 95% of the duration or more
  sets it. Last write wins by server time, except that a backwards move arriving within 2 s of the
  previous save is ignored as out of order (the stored progress is returned).
  Errors: UNAUTHENTICATED; BAD_USER_INPUT "Unknown episode"; FORBIDDEN "Premium required" (locked episode).
  """
  setProgress(episodeId: ID!, positionSec: Int!, completed: Boolean): EpisodeProgress!
}
```
