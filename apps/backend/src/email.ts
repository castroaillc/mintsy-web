import { env } from "./env.js";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const URL_PATTERN = /https?:\/\/\S+/g;

/**
 * Sends a transactional email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Without RESEND_API_KEY the email is logged instead (recipient, subject and any links), so local dev and
 * smoke tests work; in production that's an error. Throws if Resend rejects the request.
 */
export async function sendEmail({ to, subject, text, html }: Email): Promise<void> {
  if (!env.resendApiKey) {
    const links = text.match(URL_PATTERN) ?? [];
    const log = env.isProduction ? console.error : console.log;
    log(
      `[email] ${env.isProduction ? "RESEND_API_KEY is not set; NOT sent" : "not sent (no RESEND_API_KEY)"}: ` +
        `to=${to} subject=${JSON.stringify(subject)}` +
        // Links carry one-time tokens: only print them outside production
        (env.isProduction ? "" : links.map((l) => `\n  link: ${l}`).join("")),
    );
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(`Resend returned ${res.status}: ${detail}`);
  }
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * A short branded email: heading, paragraphs, an optional button and a footer note. No images or
 * tracking pixels. Paragraphs are plain text (escaped for the HTML part).
 */
export function brandedEmail(opts: {
  to: string;
  subject: string;
  heading: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  footer?: string;
}): Email {
  const { to, subject, heading, paragraphs, action, footer } = opts;
  const text = [
    heading,
    "",
    ...paragraphs.flatMap((p) => [p, ""]),
    ...(action ? [`${action.label}: ${action.url}`, ""] : []),
    ...(footer ? [footer, ""] : []),
    "mintsy · getmintsy.com",
  ].join("\n");

  const p = (s: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:#0a0a0a">${escapeHtml(s)}</p>`;
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f3f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3f6;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif">
<tr><td>
<p style="margin:0 0 24px;font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#946200">mintsy</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:28px;color:#0a0a0a">${escapeHtml(heading)}</h1>
${paragraphs.map(p).join("\n")}
${
  action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;background:#946200;color:#ffffff;text-decoration:none;font-weight:600;font-size:16px;padding:12px 20px;border-radius:999px">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 16px;font-size:13px;line-height:20px;color:#757782">Or open this link: <a href="${escapeHtml(action.url)}" style="color:#946200;word-break:break-all">${escapeHtml(action.url)}</a></p>`
    : ""
}
${footer ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:#757782">${escapeHtml(footer)}</p>` : ""}
</td></tr></table>
<p style="margin:16px 0 0;font-size:12px;color:#757782;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif">mintsy · getmintsy.com</p>
</td></tr></table>
</body></html>`;
  return { to, subject, text, html };
}
