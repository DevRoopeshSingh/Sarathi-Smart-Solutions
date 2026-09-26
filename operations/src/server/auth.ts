import "server-only";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authSchema } from "./auth-schema";
import { getDatabase, getPool } from "./db";
import { readServerEnvironment } from "./env";
import { consumeRateLimit } from "./rate-limit";

function createAuth() {
  const env = readServerEnvironment();
  return betterAuth({
    appName: "Sarathi Operations",
    baseURL: env.authOrigin,
    secret: env.authSecret,
    trustedOrigins: env.trustedOrigins,
    database: drizzleAdapter(getDatabase(), { provider: "pg", schema: authSchema }),
    // Pinned plugin schema/flow: https://better-auth.com/docs/plugins/2fa
    plugins: [twoFactor({ issuer: "Sarathi Operations", skipVerificationOnEnable: false })],
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false
    },
    session: {
      expiresIn: 8 * 60 * 60,
      updateAge: 60 * 60,
      cookieCache: { enabled: false }
    },
    advanced: {
      useSecureCookies: env.secureCookies,
      cookiePrefix: "sarathi",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax", path: "/" },
      // Our route wrapper replaces caller input with a validated platform client IP.
      ipAddress: { ipAddressHeaders: ["x-sarathi-auth-client-ip"] }
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 30 } },
      customStorage: { consume: consumeRateLimit }
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const result = await getPool().query(
              "SELECT 1 FROM sarathi.users WHERE identity_subject = $1 AND active AND role = 'ADMIN'",
              [session.userId]
            );
            if (!result.rowCount) {
              throw new APIError("UNAUTHORIZED", { message: "Invalid email or password." });
            }
            return { data: session };
          }
        }
      }
    },
    logger: { level: "error", log: () => console.error("An authentication operation failed.") }
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  auth ??= createAuth();
  return auth;
}
