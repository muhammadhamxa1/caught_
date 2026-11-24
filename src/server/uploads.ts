import fs from "node:fs/promises";
import path from "node:path";
import { publicId } from "@/lib/ids";

export const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 4 * 1024 * 1024;

// Trust the file's first bytes, not its name or the browser's mime type.
function sniff(buf: Buffer): "png" | "jpg" | "webp" | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/** Saves an uploaded image and returns its public path, or an error. */
export async function saveImage(file: File | null): Promise<{ url: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) return { error: "Images can be up to 4 MB." };
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return { error: "Upload a PNG, JPG or WebP image." };

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${publicId(16)}.${ext}`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), buf);
  return { url: `/media/${name}` };
}

/**
 * An image link typed into a form. Our own paths (demo art and uploads) are
 * kept as they are, anything else has to be a real http(s) URL.
 */
export function cleanImageUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\/(demo|media)\/[\w.\/-]+$/.test(v)) return v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}
