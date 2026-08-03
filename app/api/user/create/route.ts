import { NextResponse } from "next/server";

import { setOwnerSessionCookie } from "@/lib/auth";
import { createWork } from "@/lib/create-work";
import { assertCreationEnabled, assertWithinCreateRateLimit, clientIp } from "@/lib/rate-limit";
import { ValidationError, validateCreateForm } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 15;

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const allowedOrigin = process.env.APP_ORIGIN ?? new URL(request.url).origin;
  return origin === allowedOrigin.replace(/\/$/, "");
}

export async function POST(request: Request) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "请求来源不被允许。" }, { status: 403 });
  }

  try {
    assertCreationEnabled();
    await assertWithinCreateRateLimit(clientIp(request));

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return NextResponse.json({ error: "请求必须使用 multipart/form-data。" }, { status: 400 });
    }

    const validated = await validateCreateForm(await request.formData());
    const result = await createWork({
      image: validated.buffer,
      idempotencyKey: validated.idempotencyKey,
      request,
    });
    const response = NextResponse.json(
      {
        publicId: result.publicId,
        shareUrl: result.shareUrl,
        inviteUrl: result.inviteUrl,
      },
      { status: 201 },
    );

    if (result.ownerSessionToken) {
      setOwnerSessionCookie(response, result.ownerSessionToken);
    }

    return response;
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "CREATION_DISABLED") {
      return NextResponse.json({ error: "当前处于只读维护模式，暂不开放新创作。" }, { status: 503 });
    }
    if (error instanceof Error && error.message === "RATE_LIMITED") {
      return NextResponse.json({ error: "创作次数已达到当前时段上限，请稍后再试。" }, { status: 429 });
    }

    console.error("Unable to create work", error);
    return NextResponse.json({ error: "保存画作失败，请稍后重试。" }, { status: 503 });
  }
}
