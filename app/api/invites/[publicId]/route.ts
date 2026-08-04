import { NextResponse } from "next/server";

import { findPublicWork } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const origin = request.headers.get("origin");
  if (origin !== (process.env.APP_ORIGIN ?? new URL(request.url).origin).replace(/\/$/, "")) {
    return NextResponse.json({ error: "请求来源不被允许。" }, { status: 403 });
  }
  const work = await findPublicWork(publicId);
  if (!work || !work.allowScribbles) return NextResponse.json({ error: "这张作品暂不接受涂鸦。" }, { status: 404 });
  const response = NextResponse.json({ doodleUrl: `/p/${publicId}/doodle` });
  response.cookies.set({ name: "soul_painter_invite", value: publicId, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  return response;
}
