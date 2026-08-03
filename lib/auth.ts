import { createHash, randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

const OWNER_SESSION_COOKIE = "soul_painter_owner";

function requiredSecret(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured.`);
  }
  return value;
}

export function createOwnerSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOwnerSession(token: string) {
  return createHash("sha256")
    .update(`${requiredSecret("OWNER_SESSION_PEPPER")}:${token}`)
    .digest("hex");
}

export function setOwnerSessionCookie(response: NextResponse, token: string) {
  response.cookies.set({
    name: OWNER_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
