import { MongoClient, MongoServerError, type Collection, type Document, type IndexDescription } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.mongodbUri);
// App data (auth, push tokens, entitlements, My List, watch progress).
// MONGODB_DB if set, otherwise the database name from the connection string
export const db = client.db(env.mongodbDb);
// The catalog (`books`). READ-ONLY at runtime: studio and admin own this database, and the production
// user can't write to it, so no write or createIndex may go through this handle.
// MONGODB_CATALOG_DB if set, otherwise the same database as app data
export const catalogDb = client.db(env.mongodbCatalogDb ?? env.mongodbDb);

/** Same key, uniqueness and TTL: what the ensure*Indexes() specs set. */
function sameIndex(index: Document, spec: IndexDescription) {
  return (
    JSON.stringify(index.key) === JSON.stringify(spec.key) &&
    !!index.unique === !!spec.unique &&
    index.expireAfterSeconds === spec.expireAfterSeconds
  );
}

/**
 * Creates the indexes an app collection is missing (never use it on catalogDb). When they all exist,
 * the usual case at startup, that's one listIndexes round trip instead of one createIndex per index.
 * A spec that matches no existing index goes to createIndexes, so an options conflict still fails
 * startup, as createIndex did.
 */
export async function ensureIndexes<T extends Document>(collection: Collection<T>, specs: IndexDescription[]) {
  const existing = await collection
    .listIndexes()
    .toArray()
    .catch((err: unknown) => {
      if (err instanceof MongoServerError && err.code === 26) return []; // NamespaceNotFound: no collection yet
      throw err;
    });
  const missing = specs.filter((spec) => !existing.some((index) => sameIndex(index, spec)));
  if (missing.length) await collection.createIndexes(missing);
}
