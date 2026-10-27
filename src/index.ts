import http from "node:http";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { expressMiddleware } from "@as-integrations/express5";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";
import { client } from "./db.js";
import { ensurePushIndexes } from "./push.js";
import { env } from "./env.js";
import { typeDefs, resolvers } from "./graphql/schema.js";
import { createContext, type Context } from "./graphql/context.js";

async function main() {
  await client.connect();
  await ensurePushIndexes();

  const app = express();
  const httpServer = http.createServer(app);

  app.use(cors({ origin: env.corsOrigins, credentials: true }));

  // Better Auth must be mounted before express.json()
  app.all("/api/auth/{*any}", toNodeHandler(auth));

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
