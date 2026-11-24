import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { money, rate } from "@/lib/money";
import { loadReceipt } from "@/server/receipts";
import { ShareButtons } from "./ShareButtons";

type Props = { params: Promise<{ receiptId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = loadReceipt((await params).receiptId);
  if (!r) return { title: "Not found" };
  return {
    title: `Caught ${money(r.commissionCents)} from #${r.number}`,
    robots: { index: false },
  };
}

export default async function ReceiptPage({ params }: Props) {
  const r = loadReceipt((await params).receiptId);
  if (!r) notFound();
  const when = r.placedAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center px-5 py-10">
      <div className="lift">
        <article className="torn bg-sheet px-7 pt-8 pb-12">
          <div className="text-center">
            <Wordmark className="text-2xl" />
            <p className="mt-1 text-sm text-ink-2">@{r.handle}</p>
          </div>
          <hr className="perf my-5" />
          <p className="num text-center text-sm text-ink-2">{when}</p>
          <p className="mt-4 text-[1.0625rem] leading-snug">
            <span className="num font-semibold">#{r.number}</span> {r.name}
          </p>
          <p className="text-sm text-ink-2">Sold on {r.store}</p>
          <div className="mt-4 text-[0.9375rem]">
            <div className="flex items-baseline gap-2 py-1">
              <span>Sale</span>
              <span className="leader" />
              <span className="num">{money(r.saleCents)}</span>
            </div>
            <div className="flex items-baseline gap-2 py-1">
              <span>Rate</span>
              <span className="leader" />
              <span className="num">{rate(r.rateBps)}</span>
            </div>
          </div>
          <hr className="perf my-4" />
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-semibold">{r.refunded ? "Refunded" : "Caught"}</span>
            <span className={`num text-3xl font-semibold ${r.refunded ? "text-ink-3 line-through" : "text-money"}`}>{money(r.commissionCents || 0)}</span>
          </div>
          <hr className="perf my-4" />
          <p className="text-center text-sm text-ink-2">Nothing slips.</p>
        </article>
      </div>
      <ShareButtons receiptId={r.receiptId} />
      <Link href={`/${r.handle}`} className="mt-6 text-center text-sm text-ink-2 underline underline-offset-4">
        caughtshop.com/{r.handle}
      </Link>
    </main>
  );
}
