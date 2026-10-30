import "server-only";
import { MongoClient, type Db } from "mongodb";
import { env } from "./env";
import type { BookDoc, StudioJob } from "./types";

/** One client per process; survives dev hot reloads. */
const globalForMongo = globalThis as unknown as { __mintsyAdminMongo?: Promise<MongoClient> };

function client(): Promise<MongoClient> {
  if (!globalForMongo.__mintsyAdminMongo) {
    const c = new MongoClient(env.mongodbUri, { appName: "mintsy-admin", serverSelectionTimeoutMS: 5000 });
    globalForMongo.__mintsyAdminMongo = c.connect().catch((err) => {
      globalForMongo.__mintsyAdminMongo = undefined;
      throw err;
    });
  }
  return globalForMongo.__mintsyAdminMongo;
}

export async function db(): Promise<Db> {
  return (await client()).db(env.mongodbDb);
}

export async function booksCol() {
  return (await db()).collection<BookDoc>("books");
}

export async function jobsCol() {
  return (await db()).collection<StudioJob>("studio_jobs");
}
