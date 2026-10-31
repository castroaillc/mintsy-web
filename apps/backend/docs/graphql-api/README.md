# GraphQL API

| | |
| --- | --- |
| Endpoint | `POST https://api.getmintsy.com/graphql` (local: `http://localhost:4000/graphql`) |
| Server | Apollo Server 5 |
| Schema source | `src/graphql/schema.ts` (`typeDefs` and `resolvers` in one file) |
| Explorer | Apollo Sandbox at `GET /graphql`, development only. Introspection is off in production. |

The schema is a contract with the shipped iPhone app. Builds people already have keep calling it for weeks, so changes must be additive. See [Changing the schema](changing-the-schema.md).

## Reference

* [Types](types.md): every object type and enum, field by field
* [Queries](queries.md): `health`, `me`, `books`, `book`, `search`
* [Mutations](mutations.md): push tokens, Premium, My List, watch progress
* [Full SDL](full-sdl.md): the complete schema as printed from the source

## Authentication

GraphQL uses the Better Auth session cookie; there's no separate token. Send the cookie the way your client gets it (see [Clients](../authentication/clients.md)):

* iPhone app: `Cookie: <authClient.getCookie()>` header.
* Web app: the browser's first-party cookie on app.getmintsy.com, forwarded by the Next.js rewrite.
* curl: a cookie jar from `/api/auth/sign-in/email`.

| Access | Operations |
| --- | --- |
| Public (works signed out) | `health`, `books`, `book`, `search` |
| Session required | `me` and all `User` fields, every mutation |

Signed-out requests to session-only operations fail with `UNAUTHENTICATED`. Public operations still depend on the viewer: episodes after `FREE_EPISODES` (3) are `locked` unless the viewer has active Premium, and a locked episode hides its video, transcript and takeaways.

## Errors

Errors follow the GraphQL spec: `data` may be partial and `errors[].extensions.code` says what went wrong.

| `extensions.code` | Message | When |
| --- | --- | --- |
| `UNAUTHENTICATED` | `Not authenticated` | Session-only operation without a session (including `me`). |
| `FORBIDDEN` | `Forbidden` | A `User` field that isn't the viewer's. |
| `FORBIDDEN` | `Premium required` | `setProgress` on a locked episode. |
| `BAD_USER_INPUT` | `Invalid Expo push token` | `registerPushToken` with a malformed token. |
| `BAD_USER_INPUT` | `Unknown id` | `setSaved(saved: true)` with an id not in the catalog. |
| `BAD_USER_INPUT` | `My List is full (500 per kind)` | `setSaved` over the limit. |
| `BAD_USER_INPUT` | `Unknown episode` | `setProgress` with an unknown, unpublished or malformed episode id. |
| `BAD_USER_INPUT` | `limit must be between 0 and 50` | `me.continueWatching(limit:)` out of range. |
| `GRAPHQL_VALIDATION_FAILED` and similar | (Apollo) | Invalid query, unknown field, wrong argument type. |

## Ids

| Thing | Id format | Example |
| --- | --- | --- |
| Book | catalog `_id` (chosen by studio: `--book <id>`) | `psychology-of-money` |
| Episode | `<bookId>-<number>` | `psychology-of-money-4` |
| Search match | `<bookId>-<number>-<startSec>` | `psychology-of-money-4-131` |
| User | Better Auth user id | |

Episode ids are stable and shared by `Episode.id`, `User.savedEpisodeIds`, `EpisodeProgress.episodeId` and `EpisodeMatch.episodeId`. The app indexes `book.episodes[number - 1]`, so published episodes always form a contiguous run starting at 1.

## Media URLs

`Episode.videoUrl` and `thumbnailUrl` may be short-lived signed URLs. Refetch them instead of storing them. See [Media and signed URLs](../features/media.md).
