import { sql } from "@vercel/postgres";

export type PublicWork = {
  publicId: string;
  imageUrl: string;
  createdAt: string;
};

export type CreatedWork = PublicWork & {
  ownerSessionHash: string;
};

export async function findWorkByIdempotencyKey(idempotencyKey: string) {
  const { rows } = await sql<PublicWork>`
    SELECT
      public_id AS "publicId",
      share_image_url AS "imageUrl",
      created_at::text AS "createdAt"
    FROM works
    WHERE idempotency_key = ${idempotencyKey}
      AND status = 'ready'
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function insertReadyWork(work: {
  publicId: string;
  ownerSessionHash: string;
  idempotencyKey: string;
  objectKey: string;
  imageUrl: string;
}) {
  const { rows } = await sql<CreatedWork>`
    INSERT INTO works (
      public_id,
      owner_session_hash,
      idempotency_key,
      status,
      original_object_key,
      share_image_object_key,
      share_image_url,
      shared_at
    )
    VALUES (
      ${work.publicId},
      ${work.ownerSessionHash},
      ${work.idempotencyKey},
      'ready',
      ${work.objectKey},
      ${work.objectKey},
      ${work.imageUrl},
      NOW()
    )
    RETURNING
      public_id AS "publicId",
      share_image_url AS "imageUrl",
      created_at::text AS "createdAt",
      owner_session_hash AS "ownerSessionHash"
  `;

  return rows[0];
}

export async function findPublicWork(publicId: string) {
  const { rows } = await sql<PublicWork>`
    SELECT
      public_id AS "publicId",
      share_image_url AS "imageUrl",
      created_at::text AS "createdAt"
    FROM works
    WHERE public_id = ${publicId}
      AND status = 'ready'
      AND deleted_at IS NULL
    LIMIT 1
  `;

  return rows[0] ?? null;
}
