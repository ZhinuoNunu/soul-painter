import { randomBytes, randomUUID } from "node:crypto";

import { createOwnerSessionToken, hashOwnerSession } from "@/lib/auth";
import { findWorkByIdempotencyKey, insertReadyWork } from "@/lib/db";
import { deleteObject, uploadShareImage } from "@/lib/storage";

export type CreateWorkResult = {
  publicId: string;
  shareUrl: string;
  inviteUrl: string;
  ownerSessionToken: string;
};

export function appOrigin(request?: Request) {
  const configuredOrigin = process.env.APP_ORIGIN;
  if (configuredOrigin) {
    return configuredOrigin.replace(/\/$/, "");
  }
  if (request) {
    return new URL(request.url).origin;
  }
  throw new Error("APP_ORIGIN is not configured.");
}

function publicId() {
  return randomBytes(12).toString("base64url");
}

function toResult(work: { publicId: string }, origin: string, ownerSessionToken: string): CreateWorkResult {
  return {
    publicId: work.publicId,
    shareUrl: `${origin}/p/${work.publicId}`,
    inviteUrl: `${origin}/invite/${work.publicId}`,
    ownerSessionToken,
  };
}

export async function createWork(input: {
  image: Buffer;
  idempotencyKey: string;
  request: Request;
}) {
  const origin = appOrigin(input.request);
  const existing = await findWorkByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return toResult(existing, origin, "");
  }

  const ownerSessionToken = createOwnerSessionToken();
  const objectKey = `works/${randomUUID()}/share-v1.png`;
  const upload = await uploadShareImage(objectKey, input.image);

  try {
    const work = await insertReadyWork({
      publicId: publicId(),
      ownerSessionHash: hashOwnerSession(ownerSessionToken),
      idempotencyKey: input.idempotencyKey,
      objectKey,
      imageUrl: upload.url,
    });

    return toResult(work, origin, ownerSessionToken);
  } catch (error) {
    await deleteObject(upload.url).catch(() => undefined);

    const completedByConcurrentRequest = await findWorkByIdempotencyKey(input.idempotencyKey);
    if (completedByConcurrentRequest) {
      return toResult(completedByConcurrentRequest, origin, "");
    }

    throw error;
  }
}
