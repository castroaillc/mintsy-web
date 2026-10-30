// Legacy bootstrap: inserts books from scripts/catalog.json that don't exist in MongoDB yet.
// Usage: pnpm seed:catalog  (uses MONGODB_URI / MONGODB_DB from .env or the environment)
// MongoDB is the catalog's source of truth; the admin dashboard and studio worker manage content.
// This never overwrites or deletes an existing book ($setOnInsert only).
import { readFile } from "node:fs/promises";
import { books, type BookDoc } from "../src/catalog.js";
import { client } from "../src/db.js";

type CatalogEntry = Omit<BookDoc, "_id"> & { id: string };

const file = new URL("./catalog.json", import.meta.url);
const catalog: CatalogEntry[] = JSON.parse(await readFile(file, "utf8"));

await client.connect();
try {
  let inserted = 0;
  for (const { id, ...book } of catalog) {
    const res = await books.updateOne({ _id: id }, { $setOnInsert: book }, { upsert: true });
    inserted += res.upsertedCount;
  }
  console.log(`Inserted ${inserted} new books; left ${catalog.length - inserted} existing books untouched`);
} finally {
  await client.close();
}
