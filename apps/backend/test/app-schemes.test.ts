// The three app variants (apps/mobile/app.config.ts) against the real auth instance, with the default config:
// every flow the app uses works from each scheme, and any other scheme is rejected. Needs a local MongoDB
// replica set. Run: pnpm test
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomId, useTestEnv } from "./env.js";

const API = "http://localhost:4999";
// An empty value means the default, which is what these tests are about
useTestEnv({ MONGODB_DB: randomId("mintsy-test-schemes"), APPLE_CLIENT_ID: "com.getmintsy.signin", APPLE_APP_BUNDLE_IDENTIFIER: "" });

const { auth } = await import("../src/auth.js");
const { client, db } = await import("../src/db.js");
const { env } = await import("../src/env.js");

function request(path: string, scheme: string, init: { body?: unknown; cookie?: string; method?: string } = {}) {
  const headers: Record<string, string> = { "expo-origin": scheme };
  if (init.cookie) headers.cookie = init.cookie;
  if (init.body !== undefined) headers["content-type"] = "application/json";
  return auth.handler(
    new Request(`${API}/api/auth${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: "manual",
    }),
  );
}

const cookieHeader = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");

// Outside production, sendEmail logs each link it would send. Sending doesn't block the response, so wait for it.
const logged: string[] = [];
const realLog = console.log;

async function emailedLink(to: string, flow: string) {
  for (let i = 0; i < 100; i++) {
    const entry = logged.find((line) => line.includes(`to=${to} `));
    const link = entry?.match(/link: (\S+)/)?.[1];
    if (link) return link;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`no ${flow} email logged for ${to}`);
}

async function signUp(scheme: string) {
  const email = `${randomId("app")}@example.com`;
  const res = await request("/sign-up/email", scheme, { body: { email, password: "password1234", name: "App" } });
  assert.equal(res.status, 200);
  return { email, cookie: cookieHeader(res) };
}

describe("app schemes", () => {
  before(async () => {
    await client.connect();
    console.log = (...args: unknown[]) => {
      logged.push(args.join(" "));
    };
  });
  after(async () => {
    console.log = realLog;
    await db.dropDatabase();
    await client.close();
  });

  for (const scheme of ["mintsy://", "mintsy-dev://", "mintsy-preview://"]) {
    describe(scheme, () => {
      test("sign-up, sign-in, get-session, update-user and sign-out", async () => {
        const { email } = await signUp(scheme);

        const signIn = await request("/sign-in/email", scheme, { body: { email, password: "password1234" } });
        assert.equal(signIn.status, 200);
        const cookie = cookieHeader(signIn);

        const session = await request("/get-session", scheme, { cookie });
        assert.equal(session.status, 200);
        assert.equal(((await session.json()) as { user: { email: string } }).user.email, email);

        assert.equal((await request("/update-user", scheme, { cookie, body: { name: "Renamed" } })).status, 200);
        assert.equal((await request("/sign-out", scheme, { cookie, body: {} })).status, 200);
      });

      test("the password reset link comes back to the app's scheme", async () => {
        const { email } = await signUp(scheme);
        const redirectTo = `${scheme}reset-password`;
        const res = await request("/request-password-reset", scheme, { body: { email, redirectTo } });
        assert.equal(res.status, 200);

        const link = new URL(await emailedLink(email, "password reset"));
        assert.equal(link.origin, API);
        const opened = await auth.handler(new Request(link, { redirect: "manual" }));
        assert.equal(opened.status, 302);
        assert.match(opened.headers.get("location")!, new RegExp(`^${scheme}reset-password/?\\?token=`));
      });

      test("the change-email link comes back to the app's scheme", async () => {
        const { cookie } = await signUp(scheme);
        const newEmail = `${randomId("new")}@example.com`;
        const callbackURL = `${scheme}email-changed`;
        const res = await request("/change-email", scheme, { cookie, body: { newEmail, callbackURL } });
        assert.equal(res.status, 200);

        const link = new URL(await emailedLink(newEmail, "change email"));
        assert.equal(link.origin, API);
        const opened = await auth.handler(new Request(link, { redirect: "manual" }));
        assert.equal(opened.status, 302);
        assert.equal(opened.headers.get("location"), callbackURL);
      });
    });
  }

  // Lookalikes matter: a trusted scheme must not match by prefix
  for (const scheme of ["evil://", "mintsy-staging://", "mintsy-preview-evil://", "mintsy-previe://", "xmintsy://"]) {
    test(`${scheme} is rejected everywhere`, async () => {
      const { email, cookie } = await signUp("mintsy-preview://");

      assert.equal((await request("/sign-up/email", scheme, { body: { email: `${randomId("x")}@example.com`, password: "password1234", name: "X" } })).status, 403);
      assert.equal((await request("/sign-in/email", scheme, { body: { email, password: "password1234" } })).status, 403);
      assert.equal((await request("/update-user", scheme, { cookie, body: { name: "X" } })).status, 403);
      assert.equal((await request("/sign-out", scheme, { cookie, body: {} })).status, 403);
      // A trusted caller still can't send the emailed link to an untrusted scheme
      assert.equal((await request("/request-password-reset", "mintsy://", { body: { email, redirectTo: `${scheme}reset-password` } })).status, 403);
      assert.equal((await request("/change-email", "mintsy://", { cookie, body: { newEmail: `${randomId("x")}@example.com`, callbackURL: `${scheme}email-changed` } })).status, 403);
    });
  }

  test("native Apple ID tokens are accepted for every app variant by default, plus the Services ID", () => {
    assert.deepEqual(env.appleAppBundleIdentifiers, ["com.getmintsy.app", "com.getmintsy.app.dev", "com.getmintsy.app.preview"]);
    assert.deepEqual(auth.options.socialProviders.apple?.audience, [
      "com.getmintsy.app",
      "com.getmintsy.app.dev",
      "com.getmintsy.app.preview",
      "com.getmintsy.signin",
    ]);
  });
});
