// The app's Help center link points here (mobile-app/src/lib/support.ts: https://getmintsy.com/support).
import type { Metadata } from "next";
import { LegalPage, legalH1 } from "@/components/legal-page";
import { SUPPORT_EMAIL } from "@/lib/config";

const title = "Support · mintsy";
const description = "Help with the mintsy app, and how to contact us.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/support" },
  openGraph: { title, description, url: "/support" },
};

const faqs = [
  {
    q: "What is mintsy?",
    a: "An iPhone app that turns nonfiction books into short video series. Each chapter is a narrated, animated episode of about five minutes, with a synced transcript and three key takeaways.",
  },
  {
    q: "I forgot my password.",
    a: "On the sign-in screen, tap Forgot password? and enter your email. We'll send you a link to set a new one. If the email doesn't arrive, check your spam folder or email us.",
  },
  {
    q: "How do I change my email address?",
    a: "Open your profile, then Edit profile › Change email. We'll send a confirmation link to the new address, and the change takes effect once you tap it.",
  },
  {
    q: "How do I change my reminder time or turn reminders off?",
    a: "Open your profile, then Settings. You can also turn notifications off in the iPhone Settings app under mintsy.",
  },
  {
    q: "Can I change the playback speed or turn on captions?",
    a: "Yes. In the player, tap the speed button to cycle through 1×, 1.25×, 1.5× and 2×, and use the captions button to show the transcript on the video. Defaults for both are in Settings.",
  },
  {
    q: "How do I manage or cancel mintsy Premium?",
    a: "Subscriptions are handled by the App Store or Google Play. On iPhone, open the Settings app, tap your name, then Subscriptions. On Android, open Google Play, tap your profile, then Payments & subscriptions. Deleting your mintsy account doesn't cancel a subscription.",
  },
  {
    q: "How do I delete my account?",
    a: "In the app, open your profile, then Settings › Delete account, and confirm with your password. If you sign in with Apple or Google, there's no password to enter, but you may need to sign in with Apple or Google again first. Your account and the information linked to it are deleted immediately. Cancel any Premium subscription in the App Store or Google Play first. If you can't use the app, email us from the address you signed up with and we'll delete it within 30 days.",
  },
];

export default function Support() {
  return (
    <LegalPage>
      <h1 className={legalH1}>Support</h1>
      <p>
        Need help? Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and we&apos;ll get back to you, usually within two business days.
      </p>

      <h2>Common questions</h2>
      {faqs.map((f) => (
        <section key={f.q} className="border-t border-border pt-[18px] pb-1">
          <h3>{f.q}</h3>
          <p>{f.a}</p>
        </section>
      ))}
    </LegalPage>
  );
}
