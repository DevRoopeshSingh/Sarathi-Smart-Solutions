import "server-only";

export interface ServerEnvironment {
  databaseUrl: string;
  authOrigin: string;
  trustedOrigins: string[];
  authSecret: string;
  secureCookies: boolean;
  publicSiteUrl?: string;
}

/** Lazy validation keeps a Next build independent of deployment credentials and a live DB. */
export function readServerEnvironment(source: NodeJS.ProcessEnv = process.env): ServerEnvironment {
  const databaseUrl = source.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  let database: URL;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a PostgreSQL connection URL.");
  }
  if (!["postgres:", "postgresql:"].includes(database.protocol)) {
    throw new Error("DATABASE_URL must use postgres or postgresql.");
  }
  const authSecret = source.BETTER_AUTH_SECRET;
  if (!authSecret || authSecret.trim().length < 32) {
    throw new Error("BETTER_AUTH_SECRET requires at least 32 random characters.");
  }
  let origin: URL;
  try {
    origin = new URL(source.BETTER_AUTH_URL ?? "");
  } catch {
    throw new Error("BETTER_AUTH_URL must be an absolute origin.");
  }
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("BETTER_AUTH_URL must contain only an HTTP(S) origin.");
  }
  const production = source.NODE_ENV === "production";
  if (production && origin.protocol !== "https:") {
    throw new Error("Production BETTER_AUTH_URL requires HTTPS.");
  }
  if (
    !production &&
    origin.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)
  ) {
    throw new Error("Unencrypted authentication is allowed only on loopback in development.");
  }

  const trustedOrigins = [origin.origin];
  if (!production && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
    const port = origin.port ? `:${origin.port}` : "";
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const loopback = `${origin.protocol}//${host}${port}`;
      if (!trustedOrigins.includes(loopback)) {
        trustedOrigins.push(loopback);
      }
    }
  }

  let publicSiteUrl: string | undefined;
  if (source.PUBLIC_SITE_URL) {
    let publicUrl: URL;
    try {
      publicUrl = new URL(source.PUBLIC_SITE_URL);
    } catch {
      throw new Error("PUBLIC_SITE_URL must be an absolute HTTPS URL.");
    }
    const loopbackHttp =
      !production &&
      publicUrl.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(publicUrl.hostname);
    if (
      (publicUrl.protocol !== "https:" && !loopbackHttp) ||
      publicUrl.username ||
      publicUrl.password
    ) {
      throw new Error("PUBLIC_SITE_URL requires HTTPS, or loopback HTTP in development.");
    }
    publicSiteUrl = publicUrl.href;
  }
  return {
    databaseUrl,
    authOrigin: origin.origin,
    trustedOrigins,
    authSecret,
    secureCookies: origin.protocol === "https:",
    publicSiteUrl
  };
}
