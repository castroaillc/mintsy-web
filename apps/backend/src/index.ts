import http from "node:http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { toNodeHandler } from "better-auth/node";
import { appStoreServerApiConfigured, appStoreWebhook, ensureAppStoreIndexes } from "./app-store.js";
import { auth } from "./auth.js";
import { warmCatalog } from "./catalog.js";
import { catalogDb, client, db } from "./db.js";
import { ensureEntitlementIndexes } from "./entitlements.js";
import { ensureProgressIndexes } from "./progress.js";
import { ensurePushIndexes } from "./push.js";
import { ensureSavedIndexes } from "./saved.js";
import { revenueCatWebhook } from "./revenuecat-webhook.js";
import { env } from "./env.js";
import { versionHandler } from "./version.js";
import { typeDefs, resolvers } from "./graphql/schema.js";
import { createContext, type Context } from "./graphql/context.js";

/** Runs fn and reports how long it took, in ms. */
async function timed(fn: () => Promise<unknown>): Promise<number> {
  const start = performance.now();
  await fn();
  return Math.round(performance.now() - start);
}

async function main() {
  // Static imports are done by now, so this is the Node boot plus module loading
  const bootMs = Math.round(process.uptime() * 1000);

  const app = express();
  const httpServer = http.createServer(app);
  const apollo = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  // MongoDB (connect, then the app indexes) and Apollo start concurrently. The server only listens once
  // both are done, so no request meets a half-initialised client, and a revision that can't reach
  // MongoDB never passes Cloud Run's startup probe or the deploy's /health check. The catalog starts
  // loading as soon as MongoDB is connected; it doesn't hold up listening, and the first catalog
  // request waits for that same load instead of starting another.
  const timings = { mongoMs: 0, indexesMs: 0, apolloMs: 0 };
  await Promise.all([
    (async () => {
      timings.mongoMs = await timed(() => client.connect());
      warmCatalog();
      timings.indexesMs = await timed(() =>
        Promise.all([
          ensurePushIndexes(),
          ensureEntitlementIndexes(),
          ensureAppStoreIndexes(),
          ensureSavedIndexes(),
          ensureProgressIndexes(),
        ]),
      );
    })(),
    (async () => {
      timings.apolloMs = await timed(() => apollo.start());
    })(),
  ]);

  // The web app calls through its own origin (Next.js rewrites), so it doesn't need CORS; it's listed so
  // direct browser calls from it work too. Native apps don't send CORS preflights.
  app.use(cors({ origin: [...new Set([...env.corsOrigins, ...env.webOrigins])], credentials: true }));

  // Better Auth must be mounted before express.json()
  app.all("/api/auth/{*any}", toNodeHandler(auth));

  // RevenueCat webhook: POST /webhooks/revenuecat, with its own JSON parser
  app.use(revenueCatWebhook);

  // App Store Server Notifications V2: POST /webhooks/app-store, with its own JSON parser
  app.use(appStoreWebhook);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Which build is running (package version, commit, build time, Cloud Run revision); public
  app.get("/version", versionHandler);

  app.use("/graphql", expressMiddleware(apollo, { context: createContext }));

  await new Promise<void>((resolve) => httpServer.listen(env.port, resolve));
  const readyAt = Math.round(process.uptime() * 1000);

  console.log(`Server ready at http://localhost:${env.port}`);
  console.log(`  GraphQL:  http://localhost:${env.port}/graphql`);
  console.log(`  Database: ${db.databaseName} (catalog: ${catalogDb.databaseName})`);
  console.log(`  Media:    ${env.signedMedia ? `signed URLs (gs://${env.mediaBucket})` : env.mediaBaseUrl}`);
  if (!env.revenueCatWebhookAuth) console.warn("  REVENUECAT_WEBHOOK_AUTH is not set: /webhooks/revenuecat answers 503");
  if (!env.revenueCatSecretApiKey) console.warn("  REVENUECAT_SECRET_API_KEY is not set: entitlements come from webhook payloads only");
  if (env.appStoreLocalEnvironmentsRefused) {
    console.warn("  APP_STORE_ENVIRONMENTS lists Xcode or LocalTesting: refused in production (they can't be verified)");
  }
  if (env.appStoreEnvironments.length === 0) {
    console.warn("  APP_STORE_ENVIRONMENTS accepts no environment: every App Store purchase and notification is refused");
  }
  const appStoreLocal = env.appStoreEnvironments.filter((name) => name === "Xcode" || name === "LocalTesting");
  if (appStoreLocal.length) {
    console.warn(`  APP_STORE_ENVIRONMENTS: ${appStoreLocal.join(" and ")} transactions are accepted WITHOUT signature verification`);
  }
  if (!appStoreServerApiConfigured()) {
    const some = env.appStoreIssuerId || env.appStoreKeyId || env.appStorePrivateKey;
    console.warn(
      `  APP_STORE_ISSUER_ID, APP_STORE_KEY_ID and APP_STORE_PRIVATE_KEY are ${some ? "not all set" : "not set"}:` +
        " refreshPremium returns the stored App Store entitlement",
    );
  }
  if (env.isProduction && !env.appStoreAppAppleId) {
    console.warn("  APP_STORE_APP_APPLE_ID is not set: App Store notifications are matched by bundle id only");
  }
  if (!env.resendApiKey) {
    (env.isProduction ? console.error : console.warn)("  RESEND_API_KEY is not set: emails are logged, not sent");
  }
  if (!env.isProduction) {
    console.log(`  Auth API: http://localhost:${env.port}/api/auth/reference`);
  }
  // Since process start. After the boot, MongoDB connect then indexes run alongside Apollo's start
  console.log(
    `  Startup:  listening ${readyAt}ms after process start (node + imports ${bootMs}ms,` +
      ` mongo connect ${timings.mongoMs}ms, indexes ${timings.indexesMs}ms, apollo ${timings.apolloMs}ms)`,
  );

  const shutdown = async () => {
    await apollo.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
