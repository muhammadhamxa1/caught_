import fs from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { money, rate } from "@/lib/money";
import { loadReceipt } from "@/server/receipts";

type Params = { params: Promise<{ receiptId: string }> };

const fontDir = path.join(process.cwd(), "node_modules/@fontsource/martian-mono/files");

// A 1080x1350 image sized for a TikTok or Instagram story, styled like the
// printed receipt on the page.
export async function GET(_req: Request, { params }: Params) {
  const r = loadReceipt((await params).receiptId);
  if (!r) return new Response("Not found", { status: 404 });

  const [regular, bold] = await Promise.all([
    fs.readFile(path.join(fontDir, "martian-mono-latin-400-normal.woff")),
    fs.readFile(path.join(fontDir, "martian-mono-latin-600-normal.woff")),
  ]);

  const ink = "#141413";
  const dash = { borderTop: "4px dashed #bdb7a6", width: "100%", margin: "36px 0" };
  const when = r.placedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ece8dc", fontFamily: "Mono", color: ink }}>
        <div style={{ width: 820, display: "flex", flexDirection: "column", background: "#fbfaf6", padding: "72px 72px 80px", fontSize: 34 }}>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 56, fontWeight: 600 }}>caught#</div>
          <div style={{ display: "flex", justifyContent: "center", fontSize: 30, color: "#55534c", marginTop: 8 }}>@{r.handle}</div>
          <div style={dash} />
          <div style={{ display: "flex", justifyContent: "center", fontSize: 28, color: "#55534c" }}>{when}</div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 38, fontWeight: 600 }}>
            #{r.number} {r.name.length > 26 ? `${r.name.slice(0, 24)}...` : r.name}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#55534c", marginTop: 6 }}>Sold on {r.store}</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
            <span>Sale</span>
            <span>{money(r.saleCents)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <span>Rate</span>
            <span>{rate(r.rateBps)}</span>
          </div>
          <div style={dash} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 44, fontWeight: 600 }}>Caught</span>
            <span style={{ fontSize: 84, fontWeight: 600, color: r.refunded ? "#6e6b62" : "#157a48" }}>{money(r.commissionCents)}</span>
          </div>
          <div style={dash} />
          <div style={{ display: "flex", justifyContent: "center", fontSize: 28, color: "#55534c" }}>Nothing slips.</div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Mono", data: regular, weight: 400, style: "normal" },
        { name: "Mono", data: bold, weight: 600, style: "normal" },
      ],
    },
  );
}
