import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { expo } from "@better-auth/expo";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { openAPI } from "better-auth/plugins";
import { ObjectId } from "mongodb";
import { deleteRevenueCatSubscriber, deleteUserData } from "./account.js";
import { client, db } from "./db.js";
import { brandedEmail, sendEmail } from "./email.js";
import { env } from "./env.js";

/** The address currently stored for a user (Better Auth's mongo adapter keys users by ObjectId). */
async function currentEmail(userId: string): Promise<string | null> {
  const ids: unknown[] = [userId, ...(ObjectId.isValid(userId) ? [new ObjectId(userId)] : [])];
  const doc = await db.collection("user").findOne({ _id: { $in: ids as ObjectId[] } }, { projection: { email: 1 } });
  return (doc?.email as string | undefined) ?? null;
}

/**
 * A user without a password (signed up with Google / Apple only) can delete their account without one,
 * but only from a session created in the last 10 minutes. Older sessions get 403 REAUTH_REQUIRED, and the
 * app signs in with the provider again (which creates a fresh session) and retries.
 */
const DELETE_WITHOUT_PASSWORD_MAX_SESSION_AGE_MS = 10 * 60 * 1000;

/**
 * Social providers (native ID-token flow: POST /api/auth/sign-in/social { provider, idToken: { token, nonce? } }).
 * A provider is only configured when its client ID is set, so local dev and CI run without credentials.
 */
const googleClientIds = [...(env.googleClientId ? [env.googleClientId] : []), ...env.googleIosClientIds];
const socialProviders = {
  ...(googleClientIds.length
    ? {
        google: {
          // An array is accepted as the ID-token audience; the first entry is used for the redirect flow
          clientId: googleClientIds,
          clientSecret: env.googleClientSecret ?? "",
        },
      }
    : {}),
  ...(env.appleClientId
    ? {
        apple: {
          clientId: env.appleClientId,
          clientSecret: env.appleClientSecret ?? "",
          // Native tokens carry the bundle ID as audience; web tokens the Services ID. Setting `audience`
          // replaces Better Auth's default (appBundleIdentifier, else clientId), so list all of them.
          audience: [...env.appleAppBundleIdentifiers, env.appleClientId],
        },
      }
    : {}),
};
/**
 * Base URL. The iPhone app calls the API host (BETTER_AUTH_URL) directly. The web app proxies /api/auth/*
 * through its own origin (Next.js rewrites, which send X-Forwarded-Host: <web host>), so for those requests
 * the base URL is the web origin: OAuth redirect URIs (/api/auth/callback/{provider}), Apple's form_post
 * redirect, and email links then stay on the web host, where its cookies live. Any other host (the *.run.app
 * URL, a LAN IP in dev) falls back to BETTER_AUTH_URL, which is the old static behaviour.
 * `protocol` is fixed to BETTER_AUTH_URL's, so cookie names (__Secure- prefix on https) don't change.
 */
const apiUrl = new URL(env.betterAuthUrl);
const webHosts = env.webOrigins
  .map((origin) => new URL(origin))
  .filter((url) => url.protocol === apiUrl.protocol)
  .map((url) => url.host);
const baseURL = {
  allowedHosts: [apiUrl.host, ...webHosts],
  fallback: apiUrl.origin,
  protocol: apiUrl.protocol === "https:" ? ("https" as const) : ("http" as const),
};

/** True when an email link's final redirect (callbackURL) is a web page rather than an app deep link. */
function linkOpensWebApp(url: string) {
  try {
    return /^https?:\/\//.test(new URL(url).searchParams.get("callbackURL") ?? "");
  } catch {
    return false;
  }
}

if (!socialProviders.google) console.warn("  GOOGLE_CLIENT_ID / GOOGLE_IOS_CLIENT_ID not set: Sign in with Google is disabled");
if (!socialProviders.apple) console.warn("  APPLE_CLIENT_ID not set: Sign in with Apple is disabled");

export const auth = betterAuth({
  baseURL,
  secret: env.betterAuthSecret,
  database: mongodbAdapter(db, { client }),
  trustedOrigins: [
    ...env.corsOrigins,
    // The web app (redirectTo / callbackURL such as https://app.getmintsy.com/reset-password, and the
    // Origin header of requests proxied through it); http://localhost:3000 outside production only
    ...env.webOrigins,
    // Mobile app deep-link schemes (mobile-app/app.config.ts): production and dev variants.
    // These also allow the redirectTo / callbackURL values mintsy://reset-password, mintsy://email-changed.
    "mintsy://",
    "mintsy-dev://",
    // Expo Go / dev server URLs, development only
    ...(env.isProduction ? [] : ["exp://", "exp://**"]),
    // Apple's browser flow posts the callback from this origin (form_post); not used by native ID tokens
    ...(socialProviders.apple ? ["https://appleid.apple.com"] : []),
  ],
  socialProviders,
  account: {
    accountLinking: {
      enabled: true,
      // A Google / Apple sign-in whose (provider-verified) email matches an existing user links to it.
      // Better Auth also requires the existing user's email to be verified (requireLocalEmailVerified,
      // default true), so an unverified password account isn't linked: sign-in fails with OAUTH_LINK_ERROR.
      trustedProviders: ["google", "apple"],
    },
  },
  emailAndPassword: {
    enabled: true,
    // Link: <BETTER_AUTH_URL>/api/auth/reset-password/<token>?callbackURL=<redirectTo>, which redirects to
    // <redirectTo>?token=<token> (or ?error=INVALID_TOKEN). Unknown emails get the same response, no email.
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        brandedEmail({
          to: user.email,
          subject: "Reset your mintsy password",
          heading: "Reset your password",
          paragraphs: [
            "Someone (hopefully you) asked to reset the password for your mintsy account.",
            linkOpensWebApp(url)
              ? "Open this link to choose a new password. It expires in 1 hour."
              : "Open this link on the phone where mintsy is installed to choose a new password. It expires in 1 hour.",
          ],
          action: { label: "Reset password", url },
          footer: "If you didn't ask for this, you can ignore this email. Your password won't change.",
        }),
      );
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset signs out every device (including any session an attacker had)
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Used for the change-email flow (and /send-verification-email); sign-up doesn't send one
    sendOnSignUp: false,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      const oldEmail = await currentEmail(user.id);
      if (oldEmail && oldEmail !== user.email) {
        // change-email: `user.email` is the requested new address, which isn't stored until this link is opened
        await sendEmail(
          brandedEmail({
            to: user.email,
            subject: "Confirm your new mintsy email",
            heading: "Confirm your new email",
            paragraphs: [
              "Open this link to use this address for your mintsy account. Your email won't change until you do.",
              "The link expires in 1 hour.",
            ],
            action: { label: "Confirm email", url },
            footer: "If you didn't ask for this, you can ignore this email.",
          }),
        );
        // Heads-up (no action needed) to the address that's being replaced
        await sendEmail(
          brandedEmail({
            to: oldEmail,
            subject: "Your mintsy email is being changed",
            heading: "Email change requested",
            paragraphs: [
              `Someone signed in to your mintsy account asked to change its email to ${user.email}.`,
              "Nothing changes unless that new address is confirmed.",
            ],
            footer:
              "If this wasn't you, reset your password in the mintsy app (Sign in → Forgot password) to sign out every device.",
          }),
        );
        return;
      }
      await sendEmail(
        brandedEmail({
          to: user.email,
          subject: "Verify your mintsy email",
          heading: "Verify your email",
          paragraphs: ["Open this link to verify the email for your mintsy account. It expires in 1 hour."],
          action: { label: "Verify email", url },
          footer: "If you didn't ask for this, you can ignore this email.",
        }),
      );
    },
  },
  user: {
    // Verification goes to the new address; the stored email only changes when that link is opened
    // (updateEmailWithoutVerification stays off, and there's no extra approval step to the old address,
    // which gets a notice instead).
    changeEmail: { enabled: true },
    // POST /api/auth/delete-user { password } deletes immediately. Users with a password must send it;
    // users without one (social only) need a fresh session instead (see hooks below).
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteUserData(user.id);
      },
      afterDelete: async (user) => {
        // Again, in case anything was written between beforeDelete and the delete
        const removed = await deleteUserData(user.id);
        await deleteRevenueCatSubscriber(user.id);
        console.log(`[audit] account deleted: user ${user.id} (late cleanup: ${JSON.stringify(removed)})`);
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      // Better Auth deletes without a password when the session is under a day old (freshAge). We require
      // the password from anyone who has one, and a session under 10 minutes old from anyone who doesn't.
      if (ctx.path === "/delete-user") {
        const session = await getSessionFromCtx(ctx);
        if (!session) return; // Better Auth answers 401
        const password = (ctx.body as { password?: unknown } | undefined)?.password;
        const hasPassword = typeof password === "string" && password.length > 0;
        const credential = await ctx.context.internalAdapter.findCredentialAccount(session.user.id);
        if (credential) {
          if (!hasPassword) {
            throw new APIError("BAD_REQUEST", { message: "Password is required", code: "PASSWORD_REQUIRED" });
          }
        } else if (!hasPassword) {
          const age = Date.now() - new Date(session.session.createdAt).getTime();
          if (!(age < DELETE_WITHOUT_PASSWORD_MAX_SESSION_AGE_MS)) {
            throw new APIError("FORBIDDEN", {
              message: "Sign in again to delete your account",
              code: "REAUTH_REQUIRED",
            });
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      // Email links (change-email confirmation) open in a browser with no session, so /verify-email
      // creates a new one and the expo plugin would put its token in the deep link (?cookie=...).
      // The app keeps its own session, so don't mint a session from an email link or pass one through a
      // custom-scheme URL: revoke it and drop the cookie (this hook runs before the expo plugin's).
      if (ctx.path !== "/verify-email") return;
      const headers = ctx.context.responseHeaders;
      if (!headers?.get("set-cookie")) return;
      const created = ctx.context.newSession;
      if (created && !(ctx.request?.headers.get("cookie") ?? "").includes(created.session.token)) {
        await ctx.context.internalAdapter.deleteSession(created.session.token);
      }
      headers.delete("set-cookie");
    }),
  },
  advanced: {
    // Read X-Forwarded-Host (only to pick one of baseURL.allowedHosts; anything else uses the fallback).
    // The protocol is fixed in baseURL, so X-Forwarded-Proto is never used.
    trustedProxyHeaders: true,
    // Don't make requests wait for email delivery: a reset request for a known email would otherwise
    // take measurably longer than one for an unknown email. Errors are logged by Better Auth.
    backgroundTasks: { handler: () => {} },
  },
  // openAPI serves the auth reference at /api/auth/reference; kept out of production
  plugins: [...(env.isProduction ? [] : [openAPI()]), expo()],
});

export type Session = typeof auth.$Infer.Session;
