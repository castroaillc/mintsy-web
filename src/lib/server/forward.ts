import "server-only";
import type { NextRequest } from "next/server";
import { apiOrigin } from "./api-origin";

/**
 * Request headers that describe this hop rather than the request, so they aren't forwarded.
 * `accept-encoding` is dropped so fetch negotiates (and decodes) compression itself.
 */
const DROP_REQUEST = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

/** fetch has already decoded the body, so its encoding and length no longer apply. */
const DROP_RESPONSE = new Set(["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive", "set-cookie"]);

/**
 * Forwards a request to the same path on the API (method, body, query and headers, including Cookie, Origin
 * and Content-Type), with X-Forwarded-Host / X-Forwarded-Proto set to this app's host so Better Auth builds
 * OAuth redirect URIs and email links on the web origin. The upstream response goes back unchanged: status,
 * body, every Set-Cookie header and redirects (redirect: "manual").
 */
export async function forwardToApi(request: NextRequest) {
  const url = new URL(request.nextUrl.pathname + request.nextUrl.search, apiOrigin());

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST.has(key.toLowerCase())) headers.set(key, value);
  });
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(/:$/, "");
  headers.set("x-forwarded-host", host);
  headers.set("x-forwarded-proto", proto);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[proxy] ${request.method} ${url.pathname} failed:`, err);
    return Response.json(
      { errors: [{ message: "The mintsy API is unreachable", extensions: { code: "API_UNREACHABLE" } }] },
      { status: 502 },
    );
  }

  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE.has(key.toLowerCase())) out.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);

  const noBody = request.method === "HEAD" || upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: out,
  });
}
