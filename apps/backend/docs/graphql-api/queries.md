# Queries

| Query | Arguments | Returns | Auth |
| --- | --- | --- | --- |
| `health` | none | `String!` | public |
| `me` | none | `User` | session required |
| `books` | none | `[Book!]!` | public |
| `book` | `id: ID!` | `Book` | public |
| `search` | `query: String!` | `SearchResult!` | public |

## health

Always returns `"ok"`. Useful to check the GraphQL layer is up.

```graphql
query { health }
```

## me

The signed-in user. Although the return type is nullable, a signed-out request doesn't get `null`: it fails with `UNAUTHENTICATED`. Treat that error as "signed out".

```graphql
query Me {
  me {
    id
    email
    name
    emailVerified
    image
    premium { active expiresAt willRenew periodType productId store }
    savedBookIds
    savedEpisodeIds
    continueWatching(limit: 10) {
      episodeId
      positionSec
      durationSec
      completed
      episode { title thumbnailUrl locked }
      book { id title }
    }
    finishedBookIds
  }
}
```

```graphql
query BookProgress($bookId: ID!) {
  me {
    progress(bookId: $bookId) { episodeNumber positionSec completed updatedAt }
  }
}
```

## books

The published catalog, ordered by the book's `order` field (lowest first; the app shows the lowest as featured and the highest as "Recently added"). Public: the welcome screen shows it before sign-in.

Draft books are hidden, and each book only contains the contiguous run of published episodes starting at 1. A book with none is hidden. See [Catalog model](../catalog/README.md).

```graphql
query Books {
  books {
    id
    title
    author
    category
    coverTone
    tint
    description
    keyIdeas
    episodes {
      id
      number
      title
      summary
      durationSec
      thumbnailUrl
      videoUrl
      locked
      takeaways
      transcript { startSec text }
    }
  }
}
```

## book

One published book by id, with the same filtering as `books`. Returns `null` when the book doesn't exist, is a draft, or has no published episodes.

The app refetches this right before downloading an episode, to get a fresh signed `videoUrl`.

```graphql
query Book($id: ID!) {
  book(id: $id) {
    id
    title
    episodes { id number title durationSec locked videoUrl thumbnailUrl }
  }
}
```

## search

Public catalog search (works signed out) over book titles, authors, categories and episode transcripts.

| Rule | Detail |
| --- | --- |
| Normalisation | Whitespace is collapsed, the query is trimmed and cut to 100 characters. |
| Minimum | Under 2 characters returns empty lists without touching the database. |
| Matching | Case-insensitive literal substring. Regex characters are escaped; a space matches any whitespace; `'` matches `'`, `’` and `‘`. |
| Scope | Published catalog only (`listPublishedBooks()`). |
| Books | Title, then author, then category matches; at most 20. |
| Episodes | One match per transcript line (first occurrence), at most 3 per episode, 30 in total. Matched books are scanned first. |
| Locking | Episodes locked for this viewer are skipped, so locked transcript text never leaks. Signed-out and free viewers only get matches from episodes 1 to 3. |

```graphql
query Search($q: String!) {
  search(query: $q) {
    books { id title author }
    episodes {
      id
      bookId
      bookTitle
      episodeId
      episodeNumber
      episodeTitle
      startSec
      snippet
      matchStart
      matchLength
      episode { thumbnailUrl durationSec locked }
    }
  }
}
```

Highlight the match with `snippet.slice(matchStart, matchStart + matchLength)`.

{% hint style="info" %}
Search scans every published book on each request. That's fine for the current catalog; once it grows, the plan in `src/search.ts` is a MongoDB text index or Atlas Search.
{% endhint %}
