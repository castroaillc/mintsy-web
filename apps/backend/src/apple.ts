import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { ObjectId } from "mongodb";
import { db } from "./db.js";
import { env } from "./env.js";

/**
 * Sign in with Apple token storage and revocation (App Review guideline 5.1.1(v): an app offering Sign in
 * with Apple must revoke the user's tokens when they delete their account).
 *
 * The native ID-token sign-in gives the server only an identity token, which can't be revoked. So the app
 * also sends the one-time `authorizationCode` from expo-apple-authentication with the sign-in, as
 * `additionalData.appleAuthorizationCode`. After a successful sign-in we exchange it at Apple's token endpoint
 * (client_id = the bundle ID the identity token was issued to) and keep the refresh token on the user's
 * `apple` account document. Deleting the account revokes it. Everything here is best effort: sign-in and
 * deletion never fail because of Apple, and tokens are never logged.
 */

const APPLE_ORIGIN = "https://appleid.apple.com";
const TOKEN_URL = `${APPLE_ORIGIN}/auth/token`;
const REVOKE_URL = `${APPLE_ORIGIN}/auth/revoke`;
const TIMEOUT_MS = 5_000;

/** Fields this module adds to Better Auth's `account` document (besides `accessToken` / `refreshToken`). */
const CLIENT_ID_FIELD = "appleClientId";

let cachedKey: { pem: string; key: KeyObject } | null = null;

function signingKey(): KeyObject | null {
  const pem = env.applePrivateKey;
  if (!pem) return null;
  if (cachedKey?.pem === pem) return cachedKey.key;
  try {
    cachedKey = { pem, key: createPrivateKey(pem) };
    return cachedKey.key;
  } catch {
    console.warn("[apple] APPLE_PRIVATE_KEY can't be parsed as a PEM private key; token exchange and revocation are off");
    return null;
  }
}

/** True when the key needed for Apple's token and revoke endpoints is configured. */
export function appleTokenApiConfigured() {
  return Boolean(env.appleTeamId && env.appleKeyId && env.applePrivateKey);
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/**
 * The client_secret Apple's REST API wants: an ES256 JWT signed with the Sign in with Apple key
 * (iss = team ID, sub = client_id, aud = https://appleid.apple.com, kid = key ID). Short-lived, made per call.
 */
export function appleClientSecret(clientId: string, now = Date.now()): string | null {
  const key = signingKey();
  if (!key || !env.appleTeamId || !env.appleKeyId) return null;
  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "ES256", kid: env.appleKeyId, typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: env.appleTeamId, iat, exp: iat + 10 * 60, aud: APPLE_ORIGIN, sub: clientId }));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

/** Claims of a JWT, without verifying it (callers only pass tokens that were already verified or came from Apple). */
function jwtClaims(token: string): Record<string, unknown> | null {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"));
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

function firstAudience(claims: Record<string, unknown> | null): string | undefined {
  const aud = claims?.aud;
  if (typeof aud === "string") return aud;
  if (Array.isArray(aud) && typeof aud[0] === "string") return aud[0];
  return undefined;
}

/** Apple's error code from a failed response (`{ "error": "invalid_grant" }`), never the body as a whole. */
async function appleError(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  return `${res.status}${typeof body?.error === "string" ? ` ${body.error}` : ""}`;
}

const userIdMatch = (userId: string) => ({
  $in: [userId, ...(ObjectId.isValid(userId) ? [new ObjectId(userId)] : [])] as unknown as ObjectId[],
});

/**
 * After a successful native Apple sign-in that carried an authorization code: exchange the code and store
 * the tokens on the user's `apple` account. `identityToken` is the token Better Auth just verified; its `aud`
 * (the app's bundle ID) is the client_id the code was issued to, and its `sub` is the account ID.
 */
export async function storeAppleTokensFromCode(userId: string, identityToken: string, code: string) {
  const claims = jwtClaims(identityToken);
  const sub = typeof claims?.sub === "string" ? claims.sub : undefined;
  const clientId = firstAudience(claims);
  // Codes from the web flow (Services ID) need a redirect_uri; only native app codes are handled here
  if (!sub || !clientId || !env.appleAppBundleIdentifiers.includes(clientId)) return;
  const clientSecret = appleClientSecret(clientId);
  if (!clientSecret) {
    console.warn("[apple] authorization code received but APPLE_KEY_ID / APPLE_PRIVATE_KEY aren't set; not stored");
    return;
  }
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[apple] authorization code exchange failed for user ${userId}: ${await appleError(res)}`);
      return;
    }
    const tokens = (await res.json()) as {
      access_token?: unknown;
      refresh_token?: unknown;
      expires_in?: unknown;
      id_token?: unknown;
    };
    // The code must belong to the Apple ID that just signed in (the id_token comes straight from Apple over TLS)
    const codeSub = typeof tokens.id_token === "string" ? jwtClaims(tokens.id_token)?.sub : undefined;
    if (codeSub !== sub) {
      console.warn(`[apple] authorization code is for a different Apple ID than the sign-in for user ${userId}; not stored`);
      return;
    }
    const refreshToken = typeof tokens.refresh_token === "string" ? tokens.refresh_token : undefined;
    const accessToken = typeof tokens.access_token === "string" ? tokens.access_token : undefined;
    if (!refreshToken && !accessToken) return;
    const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : undefined;
    const result = await db.collection("account").updateOne(
      { providerId: "apple", accountId: sub, userId: userIdMatch(userId) },
      {
        $set: {
          ...(refreshToken ? { refreshToken } : {}),
          ...(accessToken ? { accessToken } : {}),
          ...(accessToken && expiresIn ? { accessTokenExpiresAt: new Date(Date.now() + expiresIn * 1000) } : {}),
          [CLIENT_ID_FIELD]: clientId,
          updatedAt: new Date(),
        },
      },
    );
    if (!result.matchedCount) console.warn(`[apple] no apple account found for user ${userId}; tokens not stored`);
  } catch (err) {
    console.warn(`[apple] authorization code exchange failed for user ${userId}: ${(err as Error)?.name ?? "error"}`);
  }
}

/**
 * POST https://appleid.apple.com/auth/revoke for every `apple` account of the user, with the stored refresh
 * token (or the access token if that's all there is). Call before Better Auth deletes the account documents.
 * Never throws; returns how many tokens Apple confirmed revoked (for tests and the audit log).
 */
export async function revokeAppleTokens(userId: string): Promise<number> {
  let revoked = 0;
  try {
    const accounts = await db
      .collection("account")
      .find({ providerId: "apple", userId: userIdMatch(userId) })
      .project<{ refreshToken?: string; accessToken?: string; idToken?: string; appleClientId?: string }>({
        refreshToken: 1,
        accessToken: 1,
        idToken: 1,
        [CLIENT_ID_FIELD]: 1,
      })
      .toArray();
    for (const account of accounts) {
      const [token, hint] = account.refreshToken
        ? [account.refreshToken, "refresh_token"]
        : account.accessToken
          ? [account.accessToken, "access_token"]
          : [undefined, undefined];
      if (!token || !hint) {
        console.log(`[apple] no Apple token stored for user ${userId}; nothing to revoke`);
        continue;
      }
      const clientId =
        account.appleClientId ?? firstAudience(account.idToken ? jwtClaims(account.idToken) : null) ?? env.appleAppBundleIdentifiers[0];
      const clientSecret = clientId ? appleClientSecret(clientId) : null;
      if (!clientId || !clientSecret) {
        console.warn(`[apple] can't revoke the Apple token of user ${userId}: APPLE_KEY_ID / APPLE_PRIVATE_KEY aren't set`);
        continue;
      }
      try {
        const res = await fetch(REVOKE_URL, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token, token_type_hint: hint }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) revoked++;
        else console.warn(`[apple] token revocation failed for user ${userId}: ${await appleError(res)}`);
      } catch (err) {
        console.warn(`[apple] token revocation failed for user ${userId}: ${(err as Error)?.name ?? "error"}`);
      }
    }
  } catch (err) {
    console.warn(`[apple] token revocation failed for user ${userId}:`, (err as Error)?.message);
  }
  return revoked;
}
