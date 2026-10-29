import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
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

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: mongodbAdapter(db, { client }),
  trustedOrigins: [
    ...env.corsOrigins,
    // Mobile app deep-link schemes (mobile-app/app.config.ts): production and dev variants.
    // These also allow the redirectTo / callbackURL values mintsy://reset-password, mintsy://email-changed.
    "mintsy://",
    "mintsy-dev://",
    // Expo Go / dev server URLs, development only
    ...(env.isProduction ? [] : ["exp://", "exp://**"]),
  ],
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
            "Open this link on the phone where mintsy is installed to choose a new password. It expires in 1 hour.",
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
    // POST /api/auth/delete-user { password } deletes immediately (password required, see hooks below)
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
      // Better Auth deletes without a password when the session is fresh; we always require it
      if (ctx.path === "/delete-user") {
        const password = (ctx.body as { password?: unknown } | undefined)?.password;
        if (typeof password !== "string" || !password) {
          throw new APIError("BAD_REQUEST", { message: "Password is required", code: "PASSWORD_REQUIRED" });
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
    // Don't make requests wait for email delivery: a reset request for a known email would otherwise
    // take measurably longer than one for an unknown email. Errors are logged by Better Auth.
    backgroundTasks: { handler: () => {} },
  },
  // openAPI serves the auth reference at /api/auth/reference; kept out of production
  plugins: [...(env.isProduction ? [] : [openAPI()]), expo()],
});

export type Session = typeof auth.$Infer.Session;
