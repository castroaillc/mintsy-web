import { API_URL, authClient } from './auth-client';

/** Minimal GraphQL fetcher that forwards the Better Auth session cookie. */
export async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: await authClient.getCookie(),
    },
    // "include" can interfere with the manually set cookie
    credentials: 'omit',
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}
