import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API proxy lives in route handlers (src/app/api/auth/[...path], src/app/graphql), not rewrites,
  // so the forwarded headers are under our control. Better Auth adds a slash before "?" in some redirects
  // (/reset-password/?token=…); keep both forms working instead of 308-ing them.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
};

export default nextConfig;
