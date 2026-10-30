// mintsy admin is local-only (no sign-in, writes straight to the catalog). Refuse to build on
// Vercel or any other hosted build so it can never be deployed by accident.
if (process.env.VERCEL || process.env.NOW_BUILDER || process.env.VERCEL_ENV) {
  console.error("mintsy-admin is local-only and must never be deployed. Deploy apps/web instead.");
  process.exit(1);
}
