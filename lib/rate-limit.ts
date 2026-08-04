import { createHash } from "node:crypto";
import { sql } from "@vercel/postgres";

function requiredSecret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function numberEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function hashRateLimitSubject(value: string) {
  return createHash("sha256").update(`${requiredSecret("RATE_LIMIT_SALT")}:${value}`).digest("hex");
}

async function assertWithinLimit(scope: string, subject: string, limitName: string, windowName: string, defaultLimit: number) {
  const windowSeconds = numberEnv(windowName, 60 * 60);
  const limit = numberEnv(limitName, defaultLimit);
  const windowStart = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000).toISOString();
  const { rows } = await sql<{ request_count: number }>`
    INSERT INTO write_rate_limits (subject_hash, scope, window_start, request_count)
    VALUES (${hashRateLimitSubject(subject)}, ${scope}, ${windowStart}, 1)
    ON CONFLICT (subject_hash, scope, window_start)
    DO UPDATE SET request_count = write_rate_limits.request_count + 1
    WHERE write_rate_limits.request_count < ${limit}
    RETURNING request_count`;
  if (rows.length !== 1) throw new Error("RATE_LIMITED");
}

export function assertCreationEnabled() {
  if (process.env.CREATE_ENABLED !== "true") throw new Error("CREATION_DISABLED");
}

export function assertScribblesEnabled() {
  if (process.env.SCRIBBLES_ENABLED !== "true") throw new Error("SCRIBBLES_DISABLED");
}

export function assertWithinCreateRateLimit(ip: string) {
  return assertWithinLimit("create", ip, "CREATE_RATE_LIMIT_PER_WINDOW", "CREATE_RATE_LIMIT_WINDOW_SECONDS", 20);
}

export async function assertWithinScribbleRateLimit(subjectHash: string, ip: string, targetPublicId: string) {
  await assertWithinLimit("scribble-subject", subjectHash, "SCRIBBLE_RATE_LIMIT_PER_WINDOW", "SCRIBBLE_RATE_LIMIT_WINDOW_SECONDS", 3);
  await assertWithinLimit("scribble-ip", ip, "SCRIBBLE_RATE_LIMIT_PER_WINDOW", "SCRIBBLE_RATE_LIMIT_WINDOW_SECONDS", 3);
  await assertWithinLimit(`scribble-target:${targetPublicId}`, targetPublicId, "SCRIBBLE_RATE_LIMIT_PER_WINDOW", "SCRIBBLE_RATE_LIMIT_WINDOW_SECONDS", 3);
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
