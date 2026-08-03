import sharp from "sharp";
import { z } from "zod";

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 413 | 415 | 422 = 400,
  ) {
    super(message);
  }
}

const createFormSchema = z.object({
  idempotencyKey: z.string().uuid(),
});

function positiveIntegerEnv(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export async function validateCreateForm(formData: FormData) {
  const parsed = createFormSchema.safeParse({
    idempotencyKey: formData.get("idempotencyKey"),
  });

  if (!parsed.success) {
    throw new ValidationError("请求缺少有效的幂等键。");
  }

  const image = formData.get("image");
  if (!(image instanceof File)) {
    throw new ValidationError("请上传画作 PNG 文件。");
  }

  const maxBytes = positiveIntegerEnv("MAX_UPLOAD_BYTES", 2 * 1024 * 1024);
  if (image.size === 0 || image.size > maxBytes) {
    throw new ValidationError("图片大小不符合限制。", 413);
  }

  if (image.type !== "image/png") {
    throw new ValidationError("目前只支持 PNG 图片。", 415);
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  if (!buffer.subarray(0, pngSignature.length).equals(pngSignature)) {
    throw new ValidationError("上传文件不是有效的 PNG 图片。", 415);
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: false }).metadata();
  } catch {
    throw new ValidationError("无法解析图片内容。", 422);
  }

  const maxPixels = positiveIntegerEnv("MAX_CANVAS_PIXELS", 768 * 768);
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (metadata.format !== "png" || width < 1 || height < 1 || width * height > maxPixels) {
    throw new ValidationError("图片尺寸不符合限制。", 422);
  }

  return { buffer, idempotencyKey: parsed.data.idempotencyKey };
}
