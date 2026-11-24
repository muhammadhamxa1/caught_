import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR } from "@/server/uploads";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

type Params = { params: Promise<{ file: string }> };

// Serves creator uploads. Local disk stands in for S3 or R2 here.
export async function GET(_req: Request, { params }: Params) {
  const { file } = await params;
  // we create these names ourselves, so anything else is refused, including ../
  const m = /^([A-Za-z0-9]{16})\.(png|jpg|webp)$/.exec(file);
  if (!m) return new NextResponse(null, { status: 404 });

  try {
    const buf = await fs.readFile(path.join(UPLOAD_DIR, file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": TYPES[m[2]],
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
