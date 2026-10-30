/**
 * Browser GraphQL fetcher: POST /graphql on this origin (proxied to the API by src/app/graphql/route.ts),
 * so the HttpOnly session cookie goes along without any CORS.
 */

export class GraphQLRequestError extends Error {
  /** GraphQL `extensions.code` (UNAUTHENTICATED, FORBIDDEN, BAD_USER_INPUT, …) or `HTTP_<status>` / `NETWORK`. */
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "GraphQLRequestError";
    this.code = code;
  }
}

type GraphQLResponse<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

export async function gql<T>(query: string, variables?: Record<string, unknown>, init?: { keepalive?: boolean }) {
  let res: Response;
  try {
    res = await fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ query, variables }),
      keepalive: init?.keepalive,
    });
  } catch {
    throw new GraphQLRequestError("Couldn’t reach mintsy. Check your connection.", "NETWORK");
  }
  let json: GraphQLResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new GraphQLRequestError(`Request failed (${res.status})`, `HTTP_${res.status}`);
  }
  if (json.errors?.length) {
    const first = json.errors[0];
    throw new GraphQLRequestError(first.message, first.extensions?.code ?? `HTTP_${res.status}`);
  }
  if (!res.ok || !json.data) throw new GraphQLRequestError(`Request failed (${res.status})`, `HTTP_${res.status}`);
  return json.data;
}

/** SWR fetcher for keys shaped `[query, variables?]`. */
export function swrFetcher<T>([query, variables]: readonly [string, Record<string, unknown>?]) {
  return gql<T>(query, variables);
}

export function errorCode(err: unknown) {
  return err instanceof GraphQLRequestError ? err.code : "UNKNOWN";
}
