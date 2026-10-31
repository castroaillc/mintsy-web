# Mutations

Every mutation needs a session. Without one it fails with `UNAUTHENTICATED`.

| Mutation | Arguments | Returns |
| --- | --- | --- |
| `registerPushToken` | `token: String!`, `platform: String!` | `Boolean!` |
| `unregisterPushToken` | `token: String!` | `Boolean!` |
| `sendTestPush` | none | `Int!` |
| `refreshPremium` | none | `Premium!` |
| `setSaved` | `kind: SavedKind!`, `id: ID!`, `saved: Boolean!` | `User!` |
| `setProgress` | `episodeId: ID!`, `positionSec: Int!`, `completed: Boolean` | `EpisodeProgress!` |

## Push notifications

### registerPushToken

Registers an Expo push token for the current user's device.

| Argument | Type | Notes |
| --- | --- | --- |
| `token` | `String!` | Must be a valid Expo push token (`Expo.isExpoPushToken`), else `BAD_USER_INPUT` "Invalid Expo push token". |
| `platform` | `String!` | Stored as given, e.g. `ios`. Not validated. |

Upserts by token: if another user had registered the same device token, it now belongs to this user. Returns `true`.

```graphql
mutation Register($token: String!) {
  registerPushToken(token: $token, platform: "ios")
}
```

### unregisterPushToken

Removes a push token, e.g. when the user signs out on that device. Only deletes the token if it belongs to the current user. Always returns `true`.

```graphql
mutation Unregister($token: String!) {
  unregisterPushToken(token: $token)
}
```

### sendTestPush

Sends a test push ("Push notifications are working") to all of the current user's devices. Returns the number of devices targeted (0 when none are registered).

```graphql
mutation { sendTestPush }
```

See [Push notifications](../features/push-notifications.md).

## Premium

### refreshPremium

Refetches the current user's subscription from RevenueCat (call right after a purchase or restore), stores it and returns it. Later fields in the same request see the new state.

Without `REVENUECAT_SECRET_API_KEY` on the server it returns the stored entitlement and logs a warning.

```graphql
mutation Refresh {
  refreshPremium { active expiresAt willRenew periodType productId store }
}
```

After it returns, refetch the catalog: episode `locked` values depend on it. See [Premium and RevenueCat](../features/premium.md).

## My List

### setSaved

Saves (`saved: true`) or removes (`saved: false`) a book or episode in the viewer's My List. Returns the updated viewer.

| Argument | Type | Notes |
| --- | --- | --- |
| `kind` | `SavedKind!` | `BOOK` or `EPISODE`. |
| `id` | `ID!` | Book id, or episode id `<bookId>-<number>`. |
| `saved` | `Boolean!` | `true` to save, `false` to remove. |

* Idempotent. Re-saving keeps the original position (`savedAt`); removing something not saved is a no-op.
* When saving, the id must exist in the catalog (drafts count), else `BAD_USER_INPUT` "Unknown id".
* At most 500 per kind, else `BAD_USER_INPUT` "My List is full (500 per kind)".
* Removing never checks the catalog, so ids of removed books can still be cleared.

```graphql
mutation Save($id: ID!) {
  setSaved(kind: BOOK, id: $id, saved: true) {
    savedBookIds
    savedEpisodeIds
  }
}
```

## Watch progress

### setProgress

Saves the viewer's place in a published episode. Call it about every 10 seconds while playing, and on pause, seek and exit.

| Argument | Type | Notes |
| --- | --- | --- |
| `episodeId` | `ID!` | `<bookId>-<number>` of a published episode. |
| `positionSec` | `Int!` | Rounded and clamped to `[0, durationSec]`. |
| `completed` | `Boolean` | `true` / `false` sets it (`false` = mark as not watched). Omitted or `null` keeps the stored value, and a position at 95% of the duration or more sets it. |

* Idempotent. Last write wins by server time, except that a backwards move arriving within 2 seconds of the previous save is ignored as out of order (the stored progress is returned). Completion changes always apply.
* Rewatching a finished episode keeps it completed unless you send `completed: false`.
* Errors: `UNAUTHENTICATED`; `BAD_USER_INPUT` "Unknown episode" (unknown, draft, unpublished or malformed id); `FORBIDDEN` "Premium required" (locked episode).

```graphql
mutation Progress($episodeId: ID!, $pos: Int!) {
  setProgress(episodeId: $episodeId, positionSec: $pos) {
    episodeId
    positionSec
    durationSec
    completed
    updatedAt
  }
}
```

A newly published episode makes a finished book unfinished again, so it shows up in `continueWatching` and leaves `finishedBookIds`.
