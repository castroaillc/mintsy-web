# Push notifications

Push goes through Expo's push service with `expo-server-sdk` (`src/push.ts`). A client registers its Expo push token, and the backend sends to every device registered for a user.

::: info No client registers tokens now
The retired Expo app was the only client that registered tokens. The [iOS app](../../services/ios.md) hasn't built push yet, and a native app gets an APNs device token, not an Expo push token, so `registerPushToken` would reject it. How iOS push reaches the backend is still to be decided.
:::

## Registering devices

| Mutation                             | Effect                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `registerPushToken(token, platform)` | Validates the token with `Expo.isExpoPushToken` (`BAD_USER_INPUT` "Invalid Expo push token" otherwise) and upserts `{ token, userId, platform, updatedAt }` into `pushTokens`. |
| `unregisterPushToken(token)`         | Deletes the token if it belongs to the current user. Call it on sign-out.                                                                                                      |

The `token` field is unique: a device token belongs to the **last** user who registered it, so signing in as someone else on the same phone moves the token to the new user.

`platform` is stored as sent (for example `ios`) and isn't validated or used for sending.

## Sending

`sendPushToUser(userId, { title, body, data? })`:

1. Loads every token for the user. Returns 0 if there are none.
2. Builds one message per token with `sound: "default"`.
3. Sends in chunks (`expo.chunkPushNotifications`).
4. Deletes tokens whose ticket comes back with `DeviceNotRegistered` (app uninstalled, etc.).
5. Returns the number of devices targeted.

It only reads push **tickets**, not push receipts, so errors Expo reports later through receipts aren't handled.

Today the only caller is the `sendTestPush` mutation, which sends "Push notifications are working" to the signed-in user's devices:

```graphql
mutation { sendTestPush }
```

TODO: confirm whether any other notifications (reminders, new episodes) are planned to be sent from the backend. None are in the code today.

## Configuration

| Variable            | Purpose                                                                            |
| ------------------- | ---------------------------------------------------------------------------------- |
| `EXPO_ACCESS_TOKEN` | Optional. Only needed if "enhanced push security" is enabled for the Expo project. |

## Data and deletion

Tokens live in `pushTokens` (indexes: `token` unique, `userId`). Account deletion removes all of a user's tokens.
