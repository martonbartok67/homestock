import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | undefined;

export function getSqlClient() {
  if (client) return client;

  const configuredUrl = process.env.TURSO_DATABASE_URL;
  const configuredToken = process.env.TURSO_AUTH_TOKEN;
  const isDevelopment = process.env.NODE_ENV !== "production";
  const hasValidTursoUrl = configuredUrl && !configuredUrl.includes("[SENSITIVE]");
  const url = hasValidTursoUrl ? configuredUrl : isDevelopment ? "file:./data/homestock.db" : undefined;
  const authToken = hasValidTursoUrl ? configuredToken : undefined;

  if (!url || (!authToken && !url.startsWith("file:"))) {
    throw new Error(
      "Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before using the database.",
    );
  }

  client = createClient({ url, ...(authToken ? { authToken } : {}) });
  return client;
}

export function getDb() {
  return drizzle(getSqlClient(), { schema });
}
