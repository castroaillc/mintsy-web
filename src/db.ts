import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.mongodbUri);
// MONGODB_DB if set, otherwise the database name from the connection string
export const db = client.db(env.mongodbDb);
