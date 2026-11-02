import type { NextRequest } from "next/server";
import { forwardToApi } from "@/lib/server/forward";

/** GraphQL, proxied to ${API_ORIGIN}/graphql with the viewer's cookies. */
export const dynamic = "force-dynamic";

const handler = (request: NextRequest) => forwardToApi(request);

export { handler as GET, handler as POST };
