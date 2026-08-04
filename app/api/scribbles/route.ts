import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createAnonymousSubjectToken, hashAnonymousSubject, setSubjectCookie, subjectCookieName } from "@/lib/auth";
import { ensureAnonymousSubject, findReplyTarget, findScribbleByIdempotency, insertVisibleScribble } from "@/lib/db";
import { assertScribblesEnabled, assertWithinScribbleRateLimit, clientIp } from "@/lib/rate-limit";
import { deleteObject, uploadScribbleImage } from "@/lib/storage";
import { ValidationError, validateCreateForm } from "@/lib/validation";

export const runtime = "nodejs";

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === (process.env.APP_ORIGIN ?? new URL(request.url).origin).replace(/\/$/, "");
}

export async function POST(request: Request) {
  if (!allowedOrigin(request)) return NextResponse.json({ error: "请求来源不被允许。" }, { status: 403 });
  try {
    assertScribblesEnabled();
    const form = await request.formData();
    const targetPublicId = form.get("targetPublicId");
    const inviteToken = form.get("inviteToken");
    if (typeof targetPublicId !== "string" || !targetPublicId || typeof inviteToken !== "string" || !inviteToken) {
      return NextResponse.json({ error: "只能通过有效邀请添加涂鸦。" }, { status: 403 });
    }
    const target = await findReplyTarget(targetPublicId);
    if (!target || !target.allowScribbles) return NextResponse.json({ error: "这张作品暂不接受涂鸦。" }, { status: 404 });
    const cookieStore = await cookies();
    let subjectToken = cookieStore.get(subjectCookieName())?.value;
    if (!subjectToken) subjectToken = createAnonymousSubjectToken();
    const subjectHash = hashAnonymousSubject(subjectToken);
    const validated = await validateCreateForm(form);
    const existing = await findScribbleByIdempotency(targetPublicId, subjectHash, validated.idempotencyKey);
    if (existing) return NextResponse.json(existing, { status: 200 });
    await assertWithinScribbleRateLimit(subjectHash, clientIp(request), targetPublicId);
    await ensureAnonymousSubject(subjectHash);
    const objectKey = `scribbles/${target.id}/${randomUUID()}.png`;
    const upload = await uploadScribbleImage(objectKey, validated.buffer);
    try {
      const scribble = await insertVisibleScribble({ targetWorkId: target.id, subjectHash, objectKey, imageUrl: upload.url, idempotencyKey: validated.idempotencyKey });
      const response = NextResponse.json(scribble, { status: 201 });
      if (!cookieStore.get(subjectCookieName())) setSubjectCookie(response, subjectToken);
      return response;
    } catch (error) {
      await deleteObject(upload.url).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof ValidationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Error && error.message === "SCRIBBLES_DISABLED") return NextResponse.json({ error: "当前暂不开放涂鸦互动。" }, { status: 503 });
    if (error instanceof Error && error.message === "RATE_LIMITED") return NextResponse.json({ error: "涂鸦次数已达到当前时段上限，请稍后再试。" }, { status: 429 });
    console.error("Unable to create scribble", error);
    return NextResponse.json({ error: "保存涂鸦失败，请稍后重试。" }, { status: 503 });
  }
}
