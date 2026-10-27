import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.mongodbUri);
// Uses the database name from the connection string
export const db = client.db();
