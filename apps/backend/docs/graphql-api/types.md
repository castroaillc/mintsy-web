# Types

Every type in `src/graphql/schema.ts`. Field descriptions are the schema's own, with notes from the resolvers. Non-null fields end in `!`.

## Catalog

### Book

A published book. Only books with at least one published episode are returned.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `ID!` | Catalog id (`BookDoc._id`), e.g. `psychology-of-money`. |
| `title` | `String!` | |
| `author` | `String!` | |
| `category` | `String!` | e.g. `Finance`, `Psychology`, `Productivity`, `Business`. |
| `coverTone` | `String!` | Cover background colour, e.g. `#E7DFCF`. |
| `tint` | `String!` | Accent colour, e.g. `#24382F`. |
| `description` | `String!` | |
| `episodes` | `[Episode!]!` | The contiguous run of published episodes starting at number 1, in order. |
| `keyIdeas` | `[String!]!` | "The book in 5 ideas", at most 5. Curated ideas when the book has them (shown to everyone); otherwise the first takeaway of each episode the viewer can watch, in order, deduplicated (so at most 3 for free viewers). Can be empty. |

### Episode

| Field | Type | Description |
| --- | --- | --- |
| `id` | `ID!` | Stable id: `<bookId>-<number>`. |
| `number` | `Int!` | 1-based position in the book. |
| `title` | `String!` | |
| `summary` | `String!` | |
| `durationSec` | `Int!` | |
| `transcript` | `[TranscriptLine!]!` | Empty when locked. |
| `takeaways` | `[String!]!` | Empty when locked. |
| `videoUrl` | `String` | Progressive MP4. Null until the video is uploaded, and null when locked. May be a short-lived signed URL: refetch rather than store it. Also null if signing fails. |
| `thumbnailUrl` | `String` | JPG. Null when the episode has no thumbnail. Not hidden when locked. May be signed (about 7 days). |
| `locked` | `Boolean!` | True when the viewer needs Premium to watch: `number > 3` (`FREE_EPISODES`) and the viewer isn't Premium. Signed-out viewers are never Premium. |

### TranscriptLine

| Field | Type | Description |
| --- | --- | --- |
| `startSec` | `Int!` | Start of the line, in seconds from the episode start. |
| `text` | `String!` | |

## Search

### SearchResult

Results of `search(query)`. Both lists are empty for queries shorter than 2 characters.

| Field | Type | Description |
| --- | --- | --- |
| `books` | `[Book!]!` | Books whose title, author or category contains the query: title matches first, then author, then category; catalog order within each group. At most 20. |
| `episodes` | `[EpisodeMatch!]!` | Transcript lines that mention the query: those from the matched books first, then the rest of the catalog, in episode and time order. At most 30, and at most 3 per episode. Locked episodes are not searched. |

### EpisodeMatch

One transcript line that mentions the search query.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `ID!` | Stable id: `<bookId>-<number>-<startSec>`. |
| `bookId` | `ID!` | |
| `bookTitle` | `String!` | |
| `episodeId` | `ID!` | Episode id: `<bookId>-<number>`. |
| `episodeNumber` | `Int!` | |
| `episodeTitle` | `String!` | |
| `episode` | `Episode!` | The full episode (thumbnail, duration, locked state). |
| `startSec` | `Int!` | Start of the matching transcript line, in seconds: open the player here. |
| `snippet` | `String!` | About 80-120 characters of the line around the match, with a leading/trailing `…` when cut. Lines up to 120 characters are returned whole. |
| `matchStart` | `Int!` | Offset of the match in `snippet`, in UTF-16 code units (JavaScript string indices). |
| `matchLength` | `Int!` | Length of the match in `snippet`, in UTF-16 code units. `snippet.slice(matchStart, matchStart + matchLength)` is the matched text. |

## The viewer

### User

Only reachable through `me` and `setSaved`, so it's always the signed-in viewer. Every field below except the scalar profile fields checks that, and throws `FORBIDDEN` otherwise.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `ID!` | Better Auth user id. Also the RevenueCat `app_user_id`. |
| `email` | `String!` | |
| `name` | `String!` | |
| `emailVerified` | `Boolean!` | Email sign-up doesn't send a verification email, so this starts false for password accounts. It becomes true after a confirmed email change. |
| `image` | `String` | Profile image URL, if the sign-in provider gave one. |
| `premium` | `Premium!` | The user's mintsy Premium subscription (RevenueCat entitlement `premium`). |
| `savedBookIds` | `[ID!]!` | Book ids the user saved to My List, most recently saved first. May include ids no longer in the catalog: skip those. |
| `savedEpisodeIds` | `[ID!]!` | Episode ids (`<bookId>-<number>`) the user saved, most recently saved first. May include ids no longer in the catalog. |
| `continueWatching(limit: Int = 10)` | `[EpisodeProgress!]!` | One entry per book, the book with the most recent activity first. Each is the book's most recently watched episode if it isn't completed, otherwise the next episode that isn't completed (`positionSec` 0 if never started). That next episode may be locked (`episode.locked`): show an upsell. Books where every published episode is completed are left out. `limit`: 0-50, else `BAD_USER_INPUT`. |
| `progress(bookId: ID!)` | `[EpisodeProgress!]!` | Every episode of the book with stored progress, by episode number. Empty if none. |
| `finishedBookIds` | `[ID!]!` | Published books whose every published episode is completed, most recently finished first. |

### Premium

| Field | Type | Description |
| --- | --- | --- |
| `active` | `Boolean!` | True while the subscription (or trial) gives access; false once `expiresAt` (and any billing grace period) has passed, even if the stored flag is stale. |
| `expiresAt` | `String` | End of the current period (ISO 8601). Null if never subscribed (or lifetime). |
| `willRenew` | `Boolean!` | False once the user cancelled or billing failed. |
| `periodType` | `String` | RevenueCat period type, lowercased: `trial`, `normal` or `intro`. Null if never subscribed. |
| `productId` | `String` | Store product id of the subscription, e.g. the yearly or monthly product. |
| `store` | `String` | Where it was bought (lowercased RevenueCat store): `app_store`, `rc_billing` (web), `stripe`, `play_store`, `promotional`, ... Null if never subscribed. Manage the subscription where it was bought. |

A user who never subscribed gets `{ active: false, expiresAt: null, willRenew: false, periodType: null, productId: null, store: null }`.

### EpisodeProgress

The viewer's place in one episode.

| Field | Type | Description |
| --- | --- | --- |
| `id` | `ID!` | Same as `episodeId`. |
| `episodeId` | `ID!` | Episode id: `<bookId>-<number>` (the same ids as `Episode.id` and `savedEpisodeIds`). |
| `bookId` | `ID!` | |
| `episodeNumber` | `Int!` | |
| `positionSec` | `Int!` | Seconds watched, between 0 and `durationSec`. |
| `durationSec` | `Int!` | The episode's duration in seconds (the current published duration, else the one stored at last save). |
| `completed` | `Boolean!` | Watched to the end: position reached 95% of the duration, or `setProgress(completed: true)`. |
| `updatedAt` | `String!` | When this was last saved (ISO 8601, server time). |
| `episode` | `Episode` | The episode, or null if it's no longer published. |
| `book` | `Book` | The book, or null if it's no longer published. |

### SavedKind

Enum used by `setSaved`.

| Value | Meaning |
| --- | --- |
| `BOOK` | A book id. |
| `EPISODE` | An episode id (`<bookId>-<number>`). |
