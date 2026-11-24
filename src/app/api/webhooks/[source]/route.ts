import { NextResponse, type NextRequest } from "next/server";
import { SIGNATURE_HEADER } from "@/server/signing";
import { handleWebhook, isWebhookSource } from "@/server/webhooks";

type Params = { params: Promise<{ source: string }> };

// TikTok Shop, Amazon, brand networks and the payout provider all post here.
// The raw body is read as text because the signature covers the exact bytes.
export async function POST(req: NextRequest, { params }: Params) {
  const { source } = await params;
  if (!isWebhookSource(source)) return NextResponse.json({ error: "Unknown source" }, { status: 404 });

  const raw = await req.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "Too large" }, { status: 413 });

  const result = handleWebhook(source, raw, req.headers.get(SIGNATURE_HEADER));
  return NextResponse.json(result.body, { status: result.status });
}
