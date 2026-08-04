import sharp from "sharp";

import { sql } from "@vercel/postgres";
import { randomUUID } from "node:crypto";

import { uploadShareImage } from "@/lib/storage";

type CompositeSource = { originalUrl: string; scribbleUrls: string[] };

async function findCompositeSource(targetPublicId: string): Promise<CompositeSource | null> {
  const { rows } = await sql<CompositeSource>`
    SELECT
      w.original_object_url AS "originalUrl",
      COALESCE(array_agg(s.image_url ORDER BY s.created_at) FILTER (WHERE s.status = 'visible'), ARRAY[]::text[]) AS "scribbleUrls"
    FROM works w
    LEFT JOIN scribbles s ON s.target_work_id = w.id
    WHERE w.public_id = ${targetPublicId} AND w.status = 'ready' AND w.deleted_at IS NULL
    GROUP BY w.id, w.original_object_url
    LIMIT 1`;
  return rows[0] ?? null;
}

async function fetchImage(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to fetch image (${response.status}).`);
  return Buffer.from(await response.arrayBuffer());
}

export async function rebuildWorkComposite(targetPublicId: string) {
  const source = await findCompositeSource(targetPublicId);
  if (!source?.originalUrl) throw new Error("Original image is unavailable for composition.");
  const base = await fetchImage(source.originalUrl);
  const overlays = await Promise.all(source.scribbleUrls.map(fetchImage));
  const composite = await sharp(base).composite(overlays.map((input) => ({ input, blend: "over" as const }))).png().toBuffer();
  const objectKey = `works/${randomUUID()}/composite-v${source.scribbleUrls.length}.png`;
  const upload = await uploadShareImage(objectKey, composite);
  await sql`
    UPDATE works
    SET share_image_object_key = ${objectKey}, share_image_url = ${upload.url}, shared_at = NOW()
    WHERE public_id = ${targetPublicId} AND status = 'ready' AND deleted_at IS NULL`;
  return upload;
}
