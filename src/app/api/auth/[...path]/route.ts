import type { NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/forward";

/**
 * Better Auth, proxied to ${API_ORIGIN}/api/auth/* so the session cookie is first-party on this origin.
 * Includes Apple's form_post callback (POST application/x-www-form-urlencoded to /api/auth/callback/apple).
 */
export const dynamic = "force-dynamic";

const handler = (request: NextRequest) => forwardToApi(request);

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS };
