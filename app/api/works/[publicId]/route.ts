import { NextResponse } from "next/server";

import { findPublicWork } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const work = await findPublicWork(publicId);
  if (!work) {
    return NextResponse.json({ error: "作品不存在。" }, { status: 404 });
  }
  return NextResponse.json(work, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
}
