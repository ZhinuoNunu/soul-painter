import { del, put } from "@vercel/blob";

export async function uploadShareImage(pathname: string, image: Buffer) {
  return put(pathname, image, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function uploadScribbleImage(pathname: string, image: Buffer) {
  return put(pathname, image, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}

export async function deleteObject(url: string) {
  await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
}
