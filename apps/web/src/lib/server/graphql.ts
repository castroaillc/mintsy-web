import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { BOOK_QUERY } from "../queries";
import type { Book } from "../types";
import { apiOrigin } from "./api-origin";

/**
 * Server-side GraphQL with the viewer's cookies, so locks and signed media match what the browser would get.
 * Never cached: video URLs are signed and expire.
 */
export async function serverGql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
  const res = await fetch(`${apiOrigin()}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data) throw new Error(`GraphQL request failed (${res.status})`);
  return json.data;
}

/** One fetch per request, shared by generateMetadata and the page. */
export const getBook = cache(async (id: string) => {
  const data = await serverGql<{ book: Book | null }>(BOOK_QUERY, { id });
  return data.book;
});
