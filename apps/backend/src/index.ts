import http from "node:http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { ensureCatalogIndexes } from "./catalog.js";
import { client } from "./db.js";
import { ensureEntitlementIndexes } from "./entitlements.js";
import { ensureProgressIndexes } from "./progress.js";
import { ensurePushIndexes } from "./push.js";
import { ensureSavedIndexes } from "./saved.js";
import { revenueCatWebhook } from "./revenuecat-webhook.js";
import { env } from "./env.js";
import { typeDefs, resolvers } from "./graphql/schema.js";
import { createContext, type Context } from "./graphql/context.js";

async function main() {
  await client.connect();
  await ensurePushIndexes();
  await ensureCatalogIndexes();
  await ensureEntitlementIndexes();
  await ensureSavedIndexes();
  await ensureProgressIndexes();

  const app = express();
  const httpServer = http.createServer(app);

  // The web app calls through its own origin (Next.js rewrites), so it doesn't need CORS; it's listed so
  // direct browser calls from it work too. Native apps don't send CORS preflights.
  app.use(cors({ origin: [...new Set([...env.corsOrigins, ...env.webOrigins])], credentials: true }));

  // Better Auth must be mounted before express.json()
  app.all("/api/auth/{*any}", toNodeHandler(auth));

  // RevenueCat webhook: POST /webhooks/revenuecat, with its own JSON parser
  app.use(revenueCatWebhook);

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const apollo = new ApolloServer<Context>({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });
  await apollo.start();

  app.use("/graphql", expressMiddleware(apollo, { context: createContext }));

  await new Promise<void>((resolve) => httpServer.listen(env.port, resolve));
  console.log(`Server ready at http://localhost:${env.port}`);
  console.log(`  GraphQL:  http://localhost:${env.port}/graphql`);
  console.log(`  Media:    ${env.signedMedia ? `signed URLs (gs://${env.mediaBucket})` : env.mediaBaseUrl}`);
  if (!env.revenueCatWebhookAuth) console.warn("  REVENUECAT_WEBHOOK_AUTH is not set: /webhooks/revenuecat answers 503");
  if (!env.revenueCatSecretApiKey) console.warn("  REVENUECAT_SECRET_API_KEY is not set: entitlements come from webhook payloads only");
  if (!env.resendApiKey) {
    (env.isProduction ? console.error : console.warn)("  RESEND_API_KEY is not set: emails are logged, not sent");
  }
  if (!env.isProduction) {
    console.log(`  Auth API: http://localhost:${env.port}/api/auth/reference`);
  }

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
