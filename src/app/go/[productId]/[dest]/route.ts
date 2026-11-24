import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { accounts, DESTINATIONS, ENTRIES, products, videos, type Destination, type Entry } from "@/db/schema";
import { config } from "@/lib/config";
import { publicId } from "@/lib/ids";
import { outboundUrl } from "@/server/networks";
import { allow, clientIp } from "@/server/ratelimit";
import { recordClick } from "@/server/tracking";

const VISITOR_COOKIE = "cv";

type Params = { params: Promise<{ productId: string; dest: string }> };

// Every buy button points here. We log the click, then send the viewer on.
// The viewer always gets redirected, even if logging is skipped, because a
// lost click is better than a lost sale.
export async function GET(req: NextRequest, { params }: Params) {
  const { productId, dest } = await params;
  if (!(DESTINATIONS as readonly string[]).includes(dest)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  const destination = dest as Destination;

  const row = db
    .select({ product: products, handle: accounts.handle })
    .from(products)
    .innerJoin(accounts, eq(accounts.id, products.accountId))
    .where(eq(products.id, productId))
    .get();
  if (!row) return NextResponse.redirect(new URL("/", req.url));

  const { product, handle } = row;
  const storeUrl =
    destination === "tiktok" ? product.tiktokUrl : destination === "amazon" ? product.amazonUrl : product.brandUrl;
  if (!storeUrl || product.status === "archived") {
    return NextResponse.redirect(new URL(`/${handle}/${product.number}`, req.url));
  }

  const q = req.nextUrl.searchParams;
  const entry: Entry = (ENTRIES as readonly string[]).includes(q.get("e") ?? "") ? (q.get("e") as Entry) : "direct";
  const videoParam = q.get("v");
  const videoId =
    videoParam &&
    db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, videoParam), eq(videos.accountId, product.accountId)))
      .get()
      ? videoParam
      : null;

  const existingVisitor = req.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = existingVisitor ?? `v_${publicId(14)}`;

  let clickId: string | null = null;
  if (allow(`go:${clientIp(req.headers)}`, 60, 60_000)) {
    clickId = recordClick({
      accountId: product.accountId,
      productId: product.id,
      videoId,
      destination,
      entry,
      visitorId,
      userAgent: req.headers.get("user-agent"),
    });
  }

  const target =
    config.sandboxNetworks && clickId
      ? new URL(`/sandbox/checkout/${clickId}`, req.url)
      : new URL(clickId ? outboundUrl(destination, storeUrl, clickId) : storeUrl);

  const res = NextResponse.redirect(target, 302);
  res.headers.set("Cache-Control", "no-store");
  if (!existingVisitor) {
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}
