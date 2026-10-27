import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { openAPI } from "better-auth/plugins";
import { client, db } from "./db.js";
import { env } from "./env.js";

export const auth = betterAuth({
  baseURL: env.betterAuthUrl,
  secret: env.betterAuthSecret,
  database: mongodbAdapter(db, { client }),
  trustedOrigins: [
    ...env.corsOrigins,
    // Mobile app deep-link schemes (mobile-app/app.config.ts): production and dev variants
    "mintsy://",
    "mintsy-dev://",
    // Expo Go / dev server URLs, development only
    ...(env.isProduction ? [] : ["exp://", "exp://**"]),
  ],
  emailAndPassword: {
    enabled: true,
  },
  // openAPI serves the auth reference at /api/auth/reference; kept out of production
  plugins: [...(env.isProduction ? [] : [openAPI()]), expo()],
});

export type Session = typeof auth.$Infer.Session;
