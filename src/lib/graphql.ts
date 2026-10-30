import { API_URL, authClient } from './auth-client';

/**
 * The API answered with an error (as opposed to a network failure, which rejects with fetch's own error).
 * `code` is the error's `extensions.code`, e.g. "UNAUTHENTICATED", "BAD_USER_INPUT", "FORBIDDEN".
 */
export class GraphQLRequestError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code: string | undefined) {
    super(message);
    this.name = 'GraphQLRequestError';
    this.code = code;
  }
}

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
  if (json.errors?.length) {
    const [first] = json.errors;
    throw new GraphQLRequestError(first.message, first.extensions?.code);
  }
  return json.data as T;
}
