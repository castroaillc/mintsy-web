import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.mongodbUri);
// App data (auth, push tokens, entitlements, My List, watch progress).
// MONGODB_DB if set, otherwise the database name from the connection string
export const db = client.db(env.mongodbDb);
// The catalog (`books`). READ-ONLY at runtime: studio and admin own this database, and the production
// user can't write to it, so no write or createIndex may go through this handle.
// MONGODB_CATALOG_DB if set, otherwise the same database as app data
export const catalogDb = client.db(env.mongodbCatalogDb ?? env.mongodbDb);
