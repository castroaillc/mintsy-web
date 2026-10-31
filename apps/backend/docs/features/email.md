# Email

`src/email.ts` sends transactional email through [Resend](https://resend.com)'s HTTP API: short branded HTML plus a plain-text part, no images, no tracking pixels.

## What's sent

| Trigger | To | Subject |
| --- | --- | --- |
| Password reset request | the account's address | Reset your mintsy password |
| Change email | the **new** address (with confirmation link) | Confirm your new mintsy email |
| Change email | the **current** address (notice, no link) | Your mintsy email is being changed |
| `/send-verification-email` (not used by sign-up) | the account's address | Verify your mintsy email |

Links expire after 1 hour. The reset email says "open this link on the phone where mintsy is installed" unless the redirect target is a web page.

## Configuration

| Variable | Purpose |
| --- | --- |
| `RESEND_API_KEY` | `re_...`. Unset = emails aren't sent; recipient, subject and (outside production) links are logged to the console, so local dev and the smoke test work. In production a missing key logs an error at startup and on every email. |
| `EMAIL_FROM` | Default `mintsy <no-reply@getmintsy.com>`. Its domain must be verified in Resend. |

{% hint style="info" %}
Locally, password-reset links are printed to the server console as `link: ...`. Use them to test the flow without email.
{% endhint %}

## Delivery

Emails are sent in the background (`advanced.backgroundTasks` in `src/auth.ts`), so requests don't wait on Resend, and a reset request for an unknown address takes as long as one for a known address. On Cloud Run with request-based CPU allocation, a send may be slowed once the response has gone out; if emails arrive late, set `--no-cpu-throttling` on the service.

## One-time Resend setup

1. Resend → Domains → add `getmintsy.com` (or a subdomain such as `mail.getmintsy.com`, then send from `no-reply@mail.getmintsy.com`).
2. Add the SPF/DKIM DNS records it shows (and optionally DMARC); wait for "Verified".
3. Leave open and click tracking **off**.
4. Create an API key with "Sending access" for that domain, store it as the secret `RESEND_API_KEY` in Secret Manager and expose it to `mintsy-api`.

For Apple private-relay addresses, also register the sending domain with Apple. See [Sign in with Google / Apple](../authentication/social-sign-in.md#one-time-setup).
