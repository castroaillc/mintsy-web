import { MongoServerError } from "mongodb";
import { books } from "./catalog.js";
import { db } from "./db.js";

/** "My List": books and episodes a user saved. One doc per saved item. */
export type SavedKind = "book" | "episode";

export interface SavedItemDoc {
  userId: string;
  kind: SavedKind;
  /** Book: catalog _id. Episode: "<bookId>-<number>". */
  id: string;
  savedAt: Date;
}

/** Most items a user can save per kind. */
export const MAX_SAVED_PER_KIND = 500;

export const savedItems = db.collection<SavedItemDoc>("saved_items");

export async function ensureSavedIndexes() {
  await savedItems.createIndex({ userId: 1, kind: 1, id: 1 }, { unique: true });
  await savedItems.createIndex({ userId: 1, kind: 1, savedAt: -1 });
}

/** Saved ids of one kind, most recently saved first. */
export async function listSaved(userId: string, kind: SavedKind): Promise<string[]> {
  return savedItems
    .find({ userId, kind }, { projection: { _id: 0, id: 1 } })
    .sort({ savedAt: -1, _id: -1 })
    .limit(MAX_SAVED_PER_KIND)
    .map((d) => d.id)
    .toArray();
}

/** True if the id exists in the catalog (any status, drafts included). */
export async function catalogHas(kind: SavedKind, id: string): Promise<boolean> {
  if (kind === "book") return (await books.countDocuments({ _id: id }, { limit: 1 })) > 0;
  const match = /^(.+)-(\d+)$/.exec(id);
  if (!match) return false;
  const [, bookId, number] = match;
  return (await books.countDocuments({ _id: bookId!, "episodes.number": Number(number) }, { limit: 1 })) > 0;
}

export type SetSavedResult = "ok" | "unknown-id" | "full";

/**
 * Adds or removes one saved item. Idempotent: saving an already-saved item keeps its original
 * savedAt (and position); removing a missing one is a no-op. Removal doesn't check the catalog,
 * so ids of items that were taken down can still be cleared.
 */
export async function setSaved(userId: string, kind: SavedKind, id: string, saved: boolean): Promise<SetSavedResult> {
  if (!saved) {
    await savedItems.deleteOne({ userId, kind, id });
    return "ok";
  }
  if (await savedItems.countDocuments({ userId, kind, id }, { limit: 1 })) return "ok";
  if (!(await catalogHas(kind, id))) return "unknown-id";
  if ((await savedItems.countDocuments({ userId, kind })) >= MAX_SAVED_PER_KIND) return "full";
  try {
    await savedItems.updateOne(
      { userId, kind, id },
      { $setOnInsert: { userId, kind, id, savedAt: new Date() } },
      { upsert: true },
    );
  } catch (err) {
    // Two concurrent saves of the same item: the other one won, which is the same outcome
    if (!(err instanceof MongoServerError && err.code === 11000)) throw err;
  }
  return "ok";
}

export async function deleteSavedForUser(userId: string) {
  return (await savedItems.deleteMany({ userId })).deletedCount;
}
