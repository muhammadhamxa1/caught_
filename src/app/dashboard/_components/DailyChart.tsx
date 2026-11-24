"use client";

import { useState } from "react";
import { compact, money, moneyShort } from "@/lib/money";

type Row = { day: string; visits: number; clicks: number; orders: number; commissionCents: number };
type Metric = "commissionCents" | "clicks" | "visits";

const METRICS: { key: Metric; label: string }[] = [
  { key: "commissionCents", label: "Commission" },
  { key: "clicks", label: "Buy clicks" },
  { key: "visits", label: "Page visits" },
];

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * pow >= v)!;
  return step * pow;
}

const fmt = (m: Metric, v: number) => (m === "commissionCents" ? money(v) : v.toLocaleString());
const fmtAxis = (m: Metric, v: number) => (m === "commissionCents" ? moneyShort(v) : compact(v));
const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// One series at a time, one axis. Commission bars are green because that is
// money landing. Traffic stays in ink.
export function DailyChart({ rows }: { rows: Row[] }) {
  const [metric, setMetric] = useState<Metric>("commissionCents");
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...rows.map((r) => r[metric]), 0));
  const ticks = [max, max / 2, 0];
  const labelEvery = rows.length > 40 ? 14 : rows.length > 10 ? 7 : 1;
  const active = hover !== null ? rows[hover] : null;
  const total = rows.reduce((s, r) => s + r[metric], 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-sunk p-1" role="tablist" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={metric === m.key}
              onClick={() => setMetric(m.key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${metric === m.key ? "bg-sheet font-semibold shadow-sm" : "text-ink-2 hover:text-ink"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-ink-2" aria-live="polite">
          {active ? (
            <>
              {label(active.day)}: <span className={`num ${metric === "commissionCents" ? "text-money" : "text-ink"}`}>{fmt(metric, active[metric])}</span>
              {metric === "commissionCents" && <span className="num"> from {active.orders} sales</span>}
            </>
          ) : (
            <>
              Total <span className={`num ${metric === "commissionCents" ? "text-money" : "text-ink"}`}>{fmt(metric, total)}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex gap-2">
        <div className="num flex h-48 flex-col justify-between pb-5 text-right text-[0.6875rem] text-ink-3">
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {fmtAxis(metric, t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between" aria-hidden>
            <div className="border-t border-dashed border-rule" />
            <div className="border-t border-dashed border-rule" />
            <div className="border-t border-rule-strong" />
          </div>
          <div className="relative flex h-48 items-end gap-[2px] pb-5" onMouseLeave={() => setHover(null)}>
            {rows.map((r, i) => {
              const h = (r[metric] / max) * 100;
              return (
                <div
                  key={r.day}
                  className="group relative flex h-full flex-1 cursor-default items-end"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={-1}
                >
                  <div
                    className={`w-full rounded-t-[4px] ${metric === "commissionCents" ? "bg-money" : "bg-ink"} ${
                      hover !== null && hover !== i ? "opacity-35" : ""
                    }`}
                    style={{ height: `${Math.max(h, r[metric] > 0 ? 1.5 : 0)}%` }}
                  />
                  {i % labelEvery === 0 && (
                    <span className="num absolute top-full mt-1 text-[0.6875rem] whitespace-nowrap text-ink-3">{label(r.day)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-2">Show as table</summary>
        <div className="mt-2 max-h-64 overflow-y-auto">
          <table className="w-full text-left">
            <thead className="text-ink-3">
              <tr>
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 text-right font-medium">Visits</th>
                <th className="py-1 text-right font-medium">Clicks</th>
                <th className="py-1 text-right font-medium">Sales</th>
                <th className="py-1 text-right font-medium">Commission</th>
              </tr>
            </thead>
            <tbody className="num">
              {[...rows].reverse().map((r) => (
                <tr key={r.day} className="border-t border-rule">
                  <td className="py-1">{label(r.day)}</td>
                  <td className="py-1 text-right">{r.visits}</td>
                  <td className="py-1 text-right">{r.clicks}</td>
                  <td className="py-1 text-right">{r.orders}</td>
                  <td className="py-1 text-right text-money">{money(r.commissionCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
