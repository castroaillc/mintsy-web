// DRAFT: written from what the app and backend collect as of the date below. Have it reviewed
// before the App Store listing goes live, and update it whenever data collection changes.
import type { Metadata } from "next";
import { LegalPage, legalH1 } from "@/components/legal-page";
import { SUPPORT_EMAIL } from "@/lib/config";
import { LEGAL_UPDATED } from "@/site";

const title = "Privacy policy · mintsy";
const description = "What mintsy collects, why, and how to have it deleted.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/privacy" },
  openGraph: { title, description, url: "/privacy" },
};

const mail = <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>;

const collected = [
  {
    what: "Your name and email address, and your password if you sign up with email",
    why: "To create and sign in to your account. Passwords are stored only as secure hashes.",
    where: "Our database (MongoDB Atlas), via our API on Google Cloud",
  },
  {
    what: "If you sign in with Apple or Google: your Apple or Google account ID, the sign-in token Apple or Google issues (which contains the same details as below), and, with Google, a link to your Google profile photo",
    why: "To sign you in with Apple or Google and connect that sign-in to your mintsy account",
    where: "Our database, while your account exists",
  },
  {
    what: "Sign-in session, including the IP address and device or browser details (user agent) of the request that created it",
    why: "To keep you signed in",
    where: "Our database, and your device's secure storage (iOS Keychain)",
  },
  {
    what: "One-time links for resetting your password or confirming a new email address",
    why: "To let you reset your password or change your email. Each link is single-use and expires shortly after it's sent.",
    where: "Our database, until the link is used or expires",
  },
  {
    what: "My List: the series and episodes you save, and when you saved each one",
    why: "To show your list on any device you sign in on",
    where: "Our database, while your account exists",
  },
  {
    what: "Watch progress: the episodes you've started or finished, your position in each, and when it was last updated",
    why: "To keep your place and let you continue on any device you sign in on",
    where: "Our database, while your account exists",
  },
  {
    what: "Push notification token and device platform (only if you allow notifications)",
    why: "To send you notifications about mintsy",
    where: "Our database, removed when you sign out",
  },
  {
    what: "mintsy Premium subscription status (only if you subscribe): whether it's active, the product, the period type (such as a free trial), the expiry date and any billing grace period, whether it will renew, the store you bought it from, and when this was last updated",
    why: "To unlock Premium content under your subscription",
    where: "Our database, while your account exists",
  },
  {
    what: "Subscription event IDs and types sent to us by RevenueCat",
    why: "To avoid processing the same subscription update twice",
    where: "Our database, deleted automatically after 90 days",
  },
  {
    what: "A record that an account was deleted, with its account ID (not your email address) and the time",
    why: "To confirm deletion requests were carried out",
    where: "Our hosting provider's logs (Google Cloud)",
  },
  {
    what: "Basic request logs (such as IP address and time of request)",
    why: "Kept automatically by our hosting providers to run and secure the service",
    where: "Google Cloud (the API and the videos) and Vercel (this website)",
  },
];

export default function Privacy() {
  return (
    <LegalPage>
      <h1 className={legalH1}>Privacy policy</h1>
      <p className="text-faint">Last updated {LEGAL_UPDATED}</p>

      <p>
        mintsy is an app that turns nonfiction books into short video episodes. This policy explains what information the mintsy app and its servers collect, why, and the
        choices you have. We keep it short because we collect very little.
      </p>

      <h2>What we collect</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Information</th>
              <th>Why</th>
              <th>Where it&apos;s kept</th>
            </tr>
          </thead>
          <tbody>
            {collected.map((r) => (
              <tr key={r.what}>
                <td>{r.what}</td>
                <td>{r.why}</td>
                <td>{r.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Signing in with Apple or Google</h2>
      <p>
        You can create a mintsy account and sign in with Sign in with Apple, Sign in with Google, or an email address and password. Sign in with Google uses Google&apos;s
        sign-in software on your device. When you use Apple or Google, we receive and store:
      </p>
      <ul>
        <li>Your Apple or Google account ID, stored with your mintsy account.</li>
        <li>
          Your email address. With Apple, this may be a private relay address (ending in <code>@privaterelay.appleid.com</code>) if you chose Hide My Email. We send account
          emails, such as password reset links, to that address, and Apple forwards them to you.
        </li>
        <li>
          Your name. Apple shares it only the first time you sign in, and only if you choose to. With Google, it comes from your Google profile.
        </li>
        <li>With Google, a link to your profile photo.</li>
      </ul>
      <p>
        We never receive your Apple or Google password. We don&apos;t post to your Apple or Google account, and we don&apos;t access any other data in it. Apple and Google
        act as sign-in providers and process your information under their own privacy policies: <a href="https://www.apple.com/legal/privacy/">Apple&apos;s privacy policy</a>{" "}
        and <a href="https://policies.google.com/privacy">Google&apos;s privacy policy</a>.
      </p>
      <p>
        If you sign in with Apple or Google using the same email address as an existing mintsy account that has a password, the two may be linked into one mintsy account, so
        you can sign in either way.
      </p>
      <p>
        You can stop mintsy from using your Apple or Google sign-in at any time in your Apple ID settings (Sign in with Apple) or your Google account settings (third-party
        connections). This doesn&apos;t delete your mintsy account; to do that, see below.
      </p>

      <h2>Subscriptions and payments</h2>
      <p>
        mintsy Premium is an optional subscription. You buy it through the Apple App Store or Google Play, which handle the payment; we never see your card or other payment
        details. We use RevenueCat, Inc. to manage subscriptions. The app identifies you to RevenueCat by your mintsy account ID, a random identifier, not your email address.
        RevenueCat receives purchase and subscription information from the store (such as the product, transaction and renewal dates, trial status, store, and country and
        currency), along with app and device information its software collects (such as app version, operating system and IP address). You can read{" "}
        <a href="https://www.revenuecat.com/privacy">RevenueCat&apos;s privacy policy</a>.
      </p>
      <p>
        We use this information only to provide the subscription you&apos;ve bought (to perform our contract with you). We don&apos;t use it for advertising and we don&apos;t
        sell it.
      </p>
      <p>
        To cancel or change your subscription, use the subscription settings in the App Store or Google Play. Deleting your mintsy account doesn&apos;t cancel a store
        subscription, so cancel it there first if you don&apos;t want to be charged again.
      </p>

      <h2>What stays on your device</h2>
      <p>
        Your onboarding answers (interests, daily goal and reminder time), app preferences (such as autoplay, captions and playback speed), theme, and daily reminder schedule
        are stored only on your device. So are your book ratings, recent searches and the time you watch each day (used for your streak). Daily reminders are scheduled locally
        and don&apos;t involve our servers.
      </p>
      <p>The app also keeps a copy of your watch progress on your device, so it works offline and syncs with our servers when you reconnect.</p>
      <p>
        If you download episodes with mintsy Premium, the episode videos, thumbnails and episode text are stored only on your device. They aren&apos;t backed up to iCloud, and
        they&apos;re deleted when you sign out, delete your account, or remove them yourself. We don&apos;t receive any information about what you&apos;ve downloaded.
      </p>

      <h2>Account emails</h2>
      <p>
        We send emails only when you ask for them: a password reset link, a link to confirm a new email address (sent to the new address), and a notice to your old address
        when your email is changed. We don&apos;t send marketing email, and these emails don&apos;t track whether you open them or click their links. They&apos;re sent by
        Resend, Inc., which processes your email address and the content of the message to deliver it. You can read{" "}
        <a href="https://resend.com/legal/privacy-policy">Resend&apos;s privacy policy</a>.
      </p>

      <h2>Feedback</h2>
      <p>
        If you send us feedback from the app, it opens an email to {mail} that includes the app version and your device&apos;s operating system and version, along with
        whatever you write. We use it only to answer you and improve mintsy.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>No advertising, and no advertising or analytics SDKs in the app.</li>
        <li>No tracking across other apps or websites.</li>
        <li>We don&apos;t sell or rent your information.</li>
      </ul>

      <h2>Service providers</h2>
      <p>
        We use Google Cloud (hosting the API and the episode videos), Vercel (hosting this website), MongoDB Atlas (database), Expo (delivering push notifications and app
        updates), RevenueCat (managing subscriptions) and Resend (sending account emails). They process data only to provide these services to us. If you use Sign in with Apple or Sign in with Google, Apple or Google also
        processes your sign-in under its own privacy policy (see above).
      </p>

      <h2>Keeping and deleting your data</h2>
      <p>We keep your account information, including your saved list, watch progress and subscription status, while your account exists.</p>
      <p>
        You can delete your account in the app: open your profile, then Settings › Delete account, and confirm with your password. If you sign in only with Apple or Google,
        there&apos;s no password to enter; instead we may ask you to sign in with Apple or Google again first. Deletion happens immediately. It removes your account, sign-in
        sessions, any Apple and Google sign-in links, My List, watch progress, push notification tokens and subscription status from our database, and we ask RevenueCat to delete its
        customer record for you. We keep only a log entry with your account ID (not your email address) recording that the deletion happened.
      </p>
      <p>Deleting your account doesn&apos;t cancel an App Store or Google Play subscription; cancel it in your store&apos;s subscription settings first.</p>
      <p>
        If you can&apos;t use the app, you can also email {mail} from the address you signed up with (if you used Apple&apos;s Hide My Email, tell us the relay address shown
        in your Apple ID settings), and we&apos;ll delete your account within 30 days.
      </p>

      <h2>Children</h2>
      <p>mintsy isn&apos;t directed at children under 13, and we don&apos;t knowingly collect information from them.</p>

      <h2>Changes</h2>
      <p>If we change what we collect, we&apos;ll update this page and the date at the top before the change takes effect.</p>

      <h2>Contact</h2>
      <p>Questions about privacy: {mail}.</p>
    </LegalPage>
  );
}
