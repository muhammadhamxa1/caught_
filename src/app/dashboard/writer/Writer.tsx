"use client";

import { useState, useTransition } from "react";
import { checkClaims, type ClaimHit } from "@/lib/claims";
import type { WriterResult } from "@/server/writer";
import { writeKitAction } from "../_actions/writer";

type Option = { id: string; label: string };

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      }}
      className="shrink-0 rounded-md px-2 py-1 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-sunk"
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Flags({ hits }: { hits: ClaimHit[] }) {
  if (hits.length === 0) return <p className="text-sm text-ink-2">No risky wording found.</p>;
  return (
    <ul className="grid gap-2 text-sm">
      {hits.map((h) => (
        <li key={`${h.id}-${h.index}`} className="rounded-lg bg-sunk px-3 py-2">
          <span className="font-semibold">&quot;{h.match}&quot;</span> {h.why} <span className="text-ink-2">{h.instead}</span>
        </li>
      ))}
    </ul>
  );
}

export function Writer({ options, initialId }: { options: Option[]; initialId?: string }) {
  const [productId, setProductId] = useState(initialId ?? options[0]?.id ?? "");
  const [seed, setSeed] = useState(1);
  const [kit, setKit] = useState<WriterResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [own, setOwn] = useState("");
  const ownHits = checkClaims(own);

  const run = (nextSeed: number) =>
    start(async () => {
      setError("");
      const r = await writeKitAction(productId, nextSeed);
      if (r.error || !r.kit) return setError(r.error ?? "Something went wrong.");
      setSeed(nextSeed);
      setKit(r.kit);
    });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="grid content-start gap-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="product">
              Product
            </label>
            <select
              id="product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setKit(null);
              }}
              className="field h-11"
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={() => run(kit ? seed + 1 : 1)} disabled={pending || !productId} className="btn btn-primary h-11 px-5">
            {pending ? "Writing" : kit ? "Try another" : "Write it"}
          </button>
        </div>
        {error && <p className="text-sm text-alert">{error}</p>}

        {kit && (
          <div className="grid gap-4">
            <section className="rounded-2xl bg-sheet p-5 shadow-[inset_0_0_0_1px_var(--color-rule)]">
              <h2 className="mb-2 font-semibold">Hooks for the first second</h2>
              <ul className="divide-y divide-rule">
                {kit.hooks.map((h) => (
                  <li key={h} className="flex items-center gap-3 py-2">
                    <span className="flex-1">{h}</span>
                    <Copy text={h} />
                  </li>
                ))}
              </ul>
            </section>
            {[
              { title: "Caption", text: kit.caption },
              { title: "Pinned comment", text: kit.pinnedComment },
              { title: "Reply to \"link??\" comments", text: kit.linkReply },
            ].map((b) => (
              <section key={b.title} className="rounded-2xl bg-sheet p-5 shadow-[inset_0_0_0_1px_var(--color-rule)]">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{b.title}</h2>
                  <Copy text={b.text} />
                </div>
                <p className="text-[0.9375rem] leading-relaxed">{b.text}</p>
              </section>
            ))}
            <section>
              <h2 className="mb-2 font-semibold">Claim check</h2>
              <Flags hits={kit.flags} />
              <p className="mt-2 text-xs text-ink-3">{kit.source === "model" ? "Written by your connected model." : "Written by the built in writer."}</p>
            </section>
          </div>
        )}
      </div>

      <aside className="h-fit rounded-2xl bg-sunk p-5">
        <h2 className="font-semibold">Check your own caption</h2>
        <p className="mt-1 mb-3 text-sm text-ink-2">
          One health claim can get a product link pulled, and repeat violations can freeze commissions. Paste a caption before you post.
        </p>
        <textarea
          value={own}
          onChange={(e) => setOwn(e.target.value)}
          rows={5}
          placeholder="this serum cleared my acne in a week"
          className="field mb-3"
          aria-label="Caption to check"
        />
        {own.trim() && <Flags hits={ownHits} />}
      </aside>
    </div>
  );
}
