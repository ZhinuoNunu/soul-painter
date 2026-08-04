import { sql } from "@vercel/postgres";

export type PublicScribble = { id: string; imageUrl: string; createdAt: string };
export type PublicWork = {
  publicId: string;
  imageUrl: string;
  createdAt: string;
  allowScribbles: boolean;
  scribbles?: PublicScribble[];
};
export type CreatedWork = PublicWork & { ownerSessionHash: string };

type TargetWork = PublicWork & { id: string };

export async function findWorkByIdempotencyKey(idempotencyKey: string) {
  const { rows } = await sql<PublicWork>`
    SELECT public_id AS "publicId", share_image_url AS "imageUrl", created_at::text AS "createdAt", allow_scribbles AS "allowScribbles"
    FROM works WHERE idempotency_key = ${idempotencyKey} AND status = 'ready' AND deleted_at IS NULL LIMIT 1`;
  return rows[0] ?? null;
}

export async function insertReadyWork(work: { publicId: string; ownerSessionHash: string; idempotencyKey: string; objectKey: string; imageUrl: string }) {
  const { rows } = await sql<CreatedWork>`
    INSERT INTO works (public_id, owner_session_hash, idempotency_key, status, original_object_key, original_object_url, share_image_object_key, share_image_url, shared_at)
    VALUES (${work.publicId}, ${work.ownerSessionHash}, ${work.idempotencyKey}, 'ready', ${work.objectKey}, ${work.imageUrl}, ${work.objectKey}, ${work.imageUrl}, NOW())
    RETURNING public_id AS "publicId", share_image_url AS "imageUrl", created_at::text AS "createdAt", allow_scribbles AS "allowScribbles", owner_session_hash AS "ownerSessionHash"`;
  return rows[0];
}

export async function findPublicWork(publicId: string): Promise<PublicWork | null> {
  const { rows } = await sql<PublicWork>`
    SELECT public_id AS "publicId", share_image_url AS "imageUrl", created_at::text AS "createdAt", allow_scribbles AS "allowScribbles"
    FROM works WHERE public_id = ${publicId} AND status = 'ready' AND deleted_at IS NULL LIMIT 1`;
  const work = rows[0];
  if (!work) return null;
  const scribbles = await findVisibleScribbles(publicId);
  return { ...work, scribbles };
}

export async function findCompositeSource(targetPublicId: string) {
  const { rows } = await sql<{ originalUrl: string; scribbleUrls: string[] }>`
    SELECT w.original_object_url AS "originalUrl", COALESCE(array_agg(s.image_url ORDER BY s.created_at) FILTER (WHERE s.status = 'visible'), ARRAY[]::text[]) AS "scribbleUrls"
    FROM works w LEFT JOIN scribbles s ON s.target_work_id = w.id
    WHERE w.public_id = ${targetPublicId} AND w.status = 'ready' AND w.deleted_at IS NULL
    GROUP BY w.id, w.original_object_url LIMIT 1`;
  return rows[0] ?? null;
}

export async function findReplyTarget(publicId: string): Promise<TargetWork | null> {
  const { rows } = await sql<TargetWork>`
    SELECT id, public_id AS "publicId", share_image_url AS "imageUrl", created_at::text AS "createdAt", allow_scribbles AS "allowScribbles"
    FROM works WHERE public_id = ${publicId} AND status = 'ready' AND deleted_at IS NULL LIMIT 1`;
  return rows[0] ?? null;
}

export async function findVisibleScribbles(publicId: string) {
  const { rows } = await sql<PublicScribble>`
    SELECT s.id, s.image_url AS "imageUrl", s.created_at::text AS "createdAt"
    FROM scribbles s JOIN works w ON w.id = s.target_work_id
    WHERE w.public_id = ${publicId} AND s.status = 'visible'
    ORDER BY s.created_at ASC LIMIT 20`;
  return rows;
}

export async function ensureAnonymousSubject(subjectHash: string) {
  await sql`INSERT INTO anonymous_subjects (subject_hash) VALUES (${subjectHash}) ON CONFLICT (subject_hash) DO NOTHING`;
}

export async function findScribbleByIdempotency(targetPublicId: string, subjectHash: string, idempotencyKey: string) {
  const { rows } = await sql<PublicScribble>`
    SELECT s.id, s.image_url AS "imageUrl", s.created_at::text AS "createdAt"
    FROM scribbles s JOIN works w ON w.id = s.target_work_id
    WHERE w.public_id = ${targetPublicId} AND s.source_subject_hash = ${subjectHash} AND s.idempotency_key = ${idempotencyKey} LIMIT 1`;
  return rows[0] ?? null;
}

export async function insertVisibleScribble(scribble: { targetWorkId: string; subjectHash: string; objectKey: string; imageUrl: string; idempotencyKey: string }) {
  const { rows } = await sql<PublicScribble>`
    INSERT INTO scribbles (target_work_id, source_subject_hash, object_key, image_url, idempotency_key)
    VALUES (${scribble.targetWorkId}, ${scribble.subjectHash}, ${scribble.objectKey}, ${scribble.imageUrl}, ${scribble.idempotencyKey})
    RETURNING id, image_url AS "imageUrl", created_at::text AS "createdAt"`;
  return rows[0];
}
