---
name: backend-catalog
description: How the mintsy backend reads the book catalog from MongoDB, how to check what the app sees, and when the legacy seed script applies.
---
# Catalog

Paths are relative to `apps/backend/`.

- **Source of truth:** the `books` collection in MongoDB, not `scripts/catalog.json`. The studio worker inserts drafts, and the admin dashboard edits and publishes them.
- **Backend's role:** it defines the format and public filtering in `src/catalog.ts`, and reads the catalog through `MONGODB_CATALOG_DB`. If that variable is unset, the catalog falls back to the app database.
- **What the app sees:** drafts are hidden, and a book's episodes are cut to the contiguous run of published ones starting at number 1.

## Checking what the app sees

1. Query `books` through `/graphql` locally, or `https://api.getmintsy.com/graphql` for production. Reads are safe.
2. Confirm the episodes have `videoUrl` and `thumbnailUrl`.
3. Spot-check one `videoUrl` with `curl -I`.

## `pnpm seed:catalog` (legacy)

It inserts books from `scripts/catalog.json` that don't exist yet. It uses `$setOnInsert`, so it never overwrites or deletes, and it can't update an existing book. Normal content work goes through admin, not this script.

If a task does need it:

1. Check where the connection points without printing secrets, for example by printing only the host. Local Docker is fine.
2. Atlas or production: **stop and get explicit approval**, because new books go live in the app immediately with no release.
3. With split databases it needs the studio user's connection string and `MONGODB_CATALOG_DB=mintsy_studio`, because the backend user is read-only there.
4. Report which books were inserted and where.
