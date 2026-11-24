import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { accounts, ENTRIES, products, videos } from "@/db/schema";
import { publicId } from "@/lib/ids";
import { allow, clientIp } from "@/server/ratelimit";
import { recordEvent } from "@/server/tracking";

const schema = z.object({
  handle: z.string().min(1).max(40),
  type: z.enum(["page_view", "product_view", "search"]),
  productId: z.string().max(40).nullish(),
  videoId: z.string().max(60).nullish(),
  entry: z.enum(ENTRIES).nullish(),
  query: z.string().max(80).nullish(),
  resultCount: z.number().int().min(0).max(1000).nullish(),
});

// Page views, product views and searches from the public page. Sent with
// sendBeacon so they never slow the viewer down.
export async function POST(req: NextRequest) {
  if (!allow(`ev:${clientIp(req.headers)}`, 120, 60_000)) {
    return new NextResponse(null, { status: 429 });
  }

  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(JSON.parse(await req.text()));
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const account = db.select({ id: accounts.id }).from(accounts).where(eq(accounts.handle, body.handle)).get();
  if (!account) return new NextResponse(null, { status: 404 });

  // ids from the browser are only trusted if they belong to this page
  const productId =
    body.productId &&
    db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, body.productId), eq(products.accountId, account.id)))
      .get()
      ? body.productId
      : null;
  const videoId =
    body.videoId &&
    db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, body.videoId), eq(videos.accountId, account.id)))
      .get()
      ? body.videoId
      : null;

  if (body.type === "product_view" && !productId) return new NextResponse(null, { status: 400 });
  if (body.type === "search" && !body.query?.trim()) return new NextResponse(null, { status: 400 });

  const existing = req.cookies.get("cv")?.value;
  const visitorId = existing ?? `v_${publicId(14)}`;

  recordEvent({
    accountId: account.id,
    type: body.type,
    productId,
    videoId,
    entry: body.entry ?? null,
    query: body.type === "search" ? body.query : null,
    resultCount: body.type === "search" ? (body.resultCount ?? 0) : null,
    visitorId,
    userAgent: req.headers.get("user-agent"),
  });

  const res = new NextResponse(null, { status: 204 });
  if (!existing) {
    res.cookies.set("cv", visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}
