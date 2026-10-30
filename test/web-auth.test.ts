// The web app (app.getmintsy.com) calls Better Auth through Next.js rewrites. These tests send what the
// proxy forwards (Host: api host, X-Forwarded-Host: web host, the browser's Origin) and check that cookies,
// OAuth redirect URIs, Apple's form_post callback and email redirects stay on the web origin, while direct
// (iPhone app) requests behave as before. Needs a local MongoDB replica set. Run: pnpm test
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

useTestEnv({
  // Production-like: https API host, so cookies are __Secure- and Secure
  BETTER_AUTH_URL: "https://api.getmintsy.com",
  GOOGLE_CLIENT_ID: "web-client.apps.googleusercontent.com",
  GOOGLE_IOS_CLIENT_ID: "ios-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "google-secret",
  APPLE_CLIENT_ID: "com.getmintsy.signin",
  APPLE_CLIENT_SECRET: "apple-secret",
});

const { auth } = await import("../src/auth.js");
const { client } = await import("../src/db.js");

const API = "https://api.getmintsy.com";
const WEB = "https://app.getmintsy.com";

/** A request as it reaches the API: through the web proxy (default) or straight from the app. */
function request(path: string, init: { body?: unknown; form?: Record<string, string>; via?: "web" | "app"; origin?: string; forwardedHost?: string; cookie?: string; method?: string } = {}) {
  const via = init.via ?? "web";
  const headers: Record<string, string> = { host: "api.getmintsy.com" };
  if (via === "web") {
    headers["x-forwarded-host"] = init.forwardedHost ?? "app.getmintsy.com";
    headers["x-forwarded-proto"] = "https";
    headers.origin = init.origin ?? WEB;
  } else {
    headers["expo-origin"] = init.origin ?? "mintsy://";
  }
  if (init.cookie) headers.cookie = init.cookie;
  let body: string | undefined;
  if (init.form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(init.form).toString();
  } else if (init.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  return auth.handler(
    new Request(`${API}/api/auth${path}`, { method: init.method ?? (body ? "POST" : "GET"), headers, body, redirect: "manual" }),
  );
}

const cookiesOf = (res: Response) => res.headers.getSetCookie();
const cookieHeader = (res: Response) => cookiesOf(res).map((c) => c.split(";")[0]).join("; ");

describe("web app auth through the proxy", () => {
  before(async () => {
    await client.connect();
  });
  after(async () => {
    await client.close();
  });

  test("email sign-up via the web: first-party, Lax, Secure session cookie", async () => {
    const email = `${randomId("web")}@example.com`;
    const res = await request("/sign-up/email", { body: { email, password: "password1234", name: "Web" } });
    assert.equal(res.status, 200);
    const session = cookiesOf(res).find((c) => c.startsWith("__Secure-better-auth.session_token="));
    assert.ok(session, `session cookie missing: ${cookiesOf(res).join(" | ")}`);
    assert.match(session, /; Secure/i);
    assert.match(session, /; HttpOnly/i);
    assert.match(session, /; SameSite=Lax/i);
    assert.match(session, /; Path=\//i);
    assert.doesNotMatch(session, /Domain=/i, "host-only cookie, so it belongs to app.getmintsy.com");

    const me = await request("/get-session", { cookie: cookieHeader(res) });
    assert.equal(((await me.json()) as { user: { email: string } }).user.email, email);
  });

  test("an untrusted Origin is rejected", async () => {
    const res = await request("/sign-in/email", { origin: "https://evil.example.com", body: { email: "x@example.com", password: "password1234" } });
    assert.equal(res.status, 403);
  });

  test("Google redirect flow via the web uses the web callback and keeps state on the web host", async () => {
    const res = await request("/sign-in/social", { body: { provider: "google", callbackURL: `${WEB}/home`, errorCallbackURL: `${WEB}/sign-in` } });
    assert.equal(res.status, 200);
    const { url, redirect } = (await res.json()) as { url: string; redirect: boolean };
    assert.equal(redirect, true);
    const auth = new URL(url);
    assert.equal(auth.origin, "https://accounts.google.com");
    assert.equal(auth.searchParams.get("redirect_uri"), `${WEB}/api/auth/callback/google`);
    assert.equal(auth.searchParams.get("client_id"), "web-client.apps.googleusercontent.com");
    const state = cookiesOf(res).find((c) => c.startsWith("__Secure-better-auth.state="));
    assert.ok(state, "state cookie");
    assert.doesNotMatch(state, /Domain=/i);
    assert.match(state, /SameSite=Lax/i);
  });

  test("an untrusted callbackURL is rejected", async () => {
    const res = await request("/sign-in/social", { body: { provider: "google", callbackURL: "https://evil.example.com/" } });
    assert.equal(res.status, 403);
  });

  test("a forwarded host that isn't allowed falls back to the API host", async () => {
    const res = await request("/sign-in/social", { forwardedHost: "evil.example.com", body: { provider: "google", callbackURL: `${WEB}/home` } });
    assert.equal(res.status, 200);
    const { url } = (await res.json()) as { url: string };
    assert.equal(new URL(url).searchParams.get("redirect_uri"), `${API}/api/auth/callback/google`);
  });

  test("Apple: web redirect URI, and the form_post callback is redirected to GET on the web host", async () => {
    const res = await request("/sign-in/social", { body: { provider: "apple", callbackURL: `${WEB}/home` } });
    assert.equal(res.status, 200);
    const url = new URL(((await res.json()) as { url: string }).url);
    assert.equal(url.origin, "https://appleid.apple.com");
    assert.equal(url.searchParams.get("redirect_uri"), `${WEB}/api/auth/callback/apple`);
    assert.equal(url.searchParams.get("response_mode"), "form_post");
    assert.equal(url.searchParams.get("client_id"), "com.getmintsy.signin");

    // Apple POSTs the result from appleid.apple.com (cross-site, so the Lax state cookie isn't sent);
    // Better Auth answers with a redirect to the same callback as a GET, where it is
    const callback = await request("/callback/apple", {
      origin: "https://appleid.apple.com",
      form: { code: "abc", state: "xyz", user: '{"name":{"firstName":"A","lastName":"B"}}' },
    });
    assert.equal(callback.status, 302);
    const location = new URL(callback.headers.get("location")!);
    assert.equal(location.origin + location.pathname, `${WEB}/api/auth/callback/apple`);
    assert.equal(location.searchParams.get("code"), "abc");
    assert.equal(location.searchParams.get("state"), "xyz");
  });

  test("password reset and change email accept web redirect URLs", async () => {
    const ok = await request("/request-password-reset", { body: { email: "nobody@example.com", redirectTo: `${WEB}/reset-password` } });
    assert.equal(ok.status, 200);
    const dev = await request("/request-password-reset", { origin: "http://localhost:3000", forwardedHost: "localhost:3000", body: { email: "nobody@example.com", redirectTo: "http://localhost:3000/reset-password" } });
    assert.equal(dev.status, 200, "localhost:3000 is trusted outside production");
    const evil = await request("/request-password-reset", { body: { email: "nobody@example.com", redirectTo: "https://evil.example.com/reset" } });
    assert.equal(evil.status, 403);

    const email = `${randomId("web")}@example.com`;
    const signUp = await request("/sign-up/email", { body: { email, password: "password1234", name: "Web" } });
    const change = await request("/change-email", { cookie: cookieHeader(signUp), body: { newEmail: `${randomId("new")}@example.com`, callbackURL: `${WEB}/profile/settings` } });
    assert.equal(change.status, 200);
  });

  test("the iPhone app (direct, expo-origin) is unchanged", async () => {
    const email = `${randomId("app")}@example.com`;
    const res = await request("/sign-up/email", { via: "app", body: { email, password: "password1234", name: "App" } });
    assert.equal(res.status, 200);
    assert.ok(cookiesOf(res).some((c) => c.startsWith("__Secure-better-auth.session_token=")));
    const reset = await request("/request-password-reset", { via: "app", body: { email, redirectTo: "mintsy://reset-password" } });
    assert.equal(reset.status, 200);
    const evil = await request("/sign-in/email", { via: "app", origin: "evil://", body: { email, password: "password1234" } });
    assert.equal(evil.status, 403);
    // Direct requests keep the API host as the base URL
    const social = await request("/sign-in/social", { via: "app", body: { provider: "google", callbackURL: "mintsy://" } });
    assert.equal(new URL(((await social.json()) as { url: string }).url).searchParams.get("redirect_uri"), `${API}/api/auth/callback/google`);
  });
});
