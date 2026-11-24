"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/money";

export type FeedRow =
  | { kind: "sale"; at: number; id: string; number: number; name: string; destination: string; amountCents: number; receiptId: string; handle: string }
  | { kind: "click"; at: number; id: string; number: number; name: string; destination: string; entry: string; handle: string }
  | { kind: "signup"; at: number; id: string; number: number; name: string; handle: string }
  | { kind: "miss"; at: number; id: string; query: string; handle: string };

const STORE: Record<string, string> = { tiktok: "TikTok Shop", amazon: "Amazon", brand: "brand site" };
const HOW: Record<string, string> = {
  number: "typed the number",
  search: "from search",
  video: "from a video",
  list: "from the list",
  backup: "sold-out backup",
  direct: "direct link",
};

function since(at: number, now: number) {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function LiveFeed({ initial, showHandle }: { initial: FeedRow[]; showHandle: boolean }) {
  const [rows, setRows] = useState(initial);
  const [now, setNow] = useState(() => Date.now());
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/live", { cache: "no-store" });
        if (!res.ok) return;
        const next: FeedRow[] = await res.json();
        if (!alive) return;
        setRows((prev) => {
          const known = new Set(prev.map((r) => `${r.kind}:${r.id}`));
          setFresh(new Set(next.filter((r) => !known.has(`${r.kind}:${r.id}`)).map((r) => `${r.kind}:${r.id}`)));
          return next;
        });
        setNow(Date.now());
      } catch {
        // offline for a moment, try again next tick
      }
    };
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (rows.length === 0) return <p className="text-sm text-ink-2">Nothing yet. Share your page and activity shows up here.</p>;

  return (
    <ol className="divide-y divide-rule">
      {rows.map((r) => {
        const key = `${r.kind}:${r.id}`;
        return (
          <li key={key} className={`flex items-baseline gap-3 py-2 text-[0.9375rem] ${fresh.has(key) ? "animate-[flash_1.2s_ease-out]" : ""}`}>
            <span className="num w-9 shrink-0 text-xs text-ink-3">{since(r.at, now)}</span>
            <span className="min-w-0 flex-1">
              {r.kind === "sale" && (
                <>
                  Caught <span className="num font-semibold text-money">{money(r.amountCents)}</span> from{" "}
                  <span className="num">#{r.number}</span> on {STORE[r.destination]}{" "}
                  <Link href={`/r/${r.receiptId}`} className="text-sm text-ink-2 underline underline-offset-2">
                    receipt
                  </Link>
                </>
              )}
              {r.kind === "click" && (
                <>
                  <span className="num">#{r.number}</span> clicked to {STORE[r.destination]}
                  <span className="text-ink-3">, {HOW[r.entry]}</span>
                </>
              )}
              {r.kind === "signup" && (
                <>
                  Someone asked to hear about <span className="num">#{r.number}</span>
                </>
              )}
              {r.kind === "miss" && (
                <>
                  Search <span className="font-medium">&quot;{r.query}&quot;</span> found nothing
                </>
              )}
            </span>
            {showHandle && <span className="shrink-0 text-xs text-ink-3">@{r.handle}</span>}
          </li>
        );
      })}
      <style>{`@keyframes flash{from{background:var(--color-sunk)}to{background:transparent}}`}</style>
    </ol>
  );
}
