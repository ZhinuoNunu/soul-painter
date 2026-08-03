import { createHash } from "node:crypto";
import { sql } from "@vercel/postgres";

function requiredSecret(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

function numberEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function assertCreationEnabled() {
  if (process.env.CREATE_ENABLED !== "true") {
    throw new Error("CREATION_DISABLED");
  }
}

export async function assertWithinCreateRateLimit(ip: string) {
  const subjectHash = createHash("sha256")
    .update(`${requiredSecret("RATE_LIMIT_SALT")}:${ip}`)
    .digest("hex");
  const windowSeconds = numberEnv("CREATE_RATE_LIMIT_WINDOW_SECONDS", 60 * 60);
  const limit = numberEnv("CREATE_RATE_LIMIT_PER_WINDOW", 3);
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS write_rate_limits (
      subject_hash TEXT NOT NULL,
      window_start TIMESTAMPTZ NOT NULL,
      request_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (subject_hash, window_start)
    )
  `);

  const { rows } = await sql<{ request_count: number }>`
    INSERT INTO write_rate_limits (subject_hash, window_start, request_count)
    VALUES (${subjectHash}, ${windowStart.toISOString()}, 1)
    ON CONFLICT (subject_hash, window_start)
    DO UPDATE SET request_count = write_rate_limits.request_count + 1
    WHERE write_rate_limits.request_count < ${limit}
    RETURNING request_count
  `;

  if (rows.length !== 1) {
    throw new Error("RATE_LIMITED");
  }
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
