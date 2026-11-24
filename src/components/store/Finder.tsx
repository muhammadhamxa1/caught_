"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { backupFor, type PublicProduct } from "@/lib/public";
import { parseNumber, searchProducts } from "@/lib/search";
import { Price, ProductImage } from "@/components/ui";
import { BuyButtons } from "./BuyButtons";
import { ProductLines } from "./ProductLines";
import { track } from "./track";

type Props = {
  handle: string;
  firstName: string;
  products: PublicProduct[];
  latestNumbers: number[];
};

// The whole page exists for this box. A viewer types the number they heard
// in the video and gets a buy button without leaving the page. Search runs
// in the browser on data already on the page, so it is instant even on a
// slow connection inside TikTok's in-app browser.
export function Finder({ handle, firstName, products, latestNumbers }: Props) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const logged = useRef(new Set<string>());

  const listed = useMemo(() => products.filter((p) => p.status !== "archived"), [products]);
  const number = parseNumber(q);
  const exact = number !== null ? (products.find((p) => p.number === number) ?? null) : null;
  const results = useMemo(
    () => (number === null && q.trim().length > 0 ? searchProducts(listed, q).results.slice(0, 8) : []),
    [listed, number, q],
  );

  // Log after the viewer stops typing, once per distinct thing they looked for.
  useEffect(() => {
    const t = setTimeout(() => {
      const query = q.trim();
      if (!query) return;
      const key = number !== null ? `n:${number}` : `q:${query.toLowerCase()}`;
      if (logged.current.has(key)) return;
      if (number !== null) {
        logged.current.add(key);
        if (exact) track({ handle, type: "product_view", productId: exact.id, entry: "number" });
        else track({ handle, type: "search", query: `#${number}`, resultCount: 0 });
      } else if (query.length >= 2) {
        logged.current.add(key);
        track({ handle, type: "search", query, resultCount: results.length });
      }
    }, 900);
    return () => clearTimeout(t);
  }, [q, number, exact, results.length, handle]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (exact && exact.status !== "archived") router.push(`/${handle}/${exact.number}?e=number`);
    else if (results[0]) router.push(`/${handle}/${results[0].number}?e=search`);
    inputRef.current?.blur();
  }

  return (
    <section aria-label="Find a product">
      <form onSubmit={submit} role="search">
        <label htmlFor="finder" className="mb-2 block text-[0.9375rem] font-semibold">
          Type the number from the video
        </label>
        <div className="relative">
          <span aria-hidden className="num pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-2xl text-ink-3">
            #
          </span>
          <input
            ref={inputRef}
            id="finder"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="47 or lip oil"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            inputMode="search"
            className="num h-16 w-full rounded-2xl bg-sheet pr-12 pl-11 text-2xl shadow-[inset_0_0_0_2px_var(--color-ink)] outline-none placeholder:text-ink-3/70 focus:shadow-[inset_0_0_0_3px_var(--color-ink)]"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-2 hover:bg-sunk"
              aria-label="Clear"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </form>

      {!q && latestNumbers.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <span>Newest video:</span>
          {latestNumbers.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQ(String(n))}
              className="num rounded-full bg-sheet px-3 py-1.5 text-[0.9375rem] text-ink shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-sunk"
            >
              #{n}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite">
        {number !== null && (
          <NumberResult handle={handle} firstName={firstName} number={number} product={exact} all={products} />
        )}
        {number === null && q.trim().length > 0 && (
          <div className="mt-4">
            {results.length > 0 ? (
              <ProductLines handle={handle} products={results} entry="search" />
            ) : (
              <p className="rounded-xl bg-sunk px-4 py-3 text-[0.9375rem] text-ink-2">
                Nothing matches &quot;{q.trim()}&quot; yet. {firstName} sees what people search for, so it may be added soon.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function NumberResult({
  handle,
  firstName,
  number,
  product,
  all,
}: {
  handle: string;
  firstName: string;
  number: number;
  product: PublicProduct | null;
  all: PublicProduct[];
}) {
  if (!product) {
    return (
      <p className="mt-4 rounded-xl bg-sunk px-4 py-3 text-[0.9375rem] text-ink-2">
        There is no <span className="num">#{number}</span> on this page. Check the number in the video, or search by name.
      </p>
    );
  }

  if (product.status === "active") {
    return <QuickCard handle={handle} product={product} entry="number" />;
  }

  const backup = backupFor(product, all);
  return (
    <div className="mt-4 grid gap-3">
      <div className="flex items-center gap-3 rounded-xl bg-sunk px-3 py-3">
        <ProductImage src={product.imageUrl} alt="" size={44} muted />
        <p className="text-[0.9375rem] leading-snug">
          <span className="num font-semibold">#{product.number}</span> {product.name}{" "}
          {product.status === "sold_out" ? "is sold out." : "is no longer listed."}
          {backup && (
            <>
              {" "}
              {firstName} picked <span className="num font-semibold">#{backup.number}</span> instead.
            </>
          )}
        </p>
      </div>
      {backup && <QuickCard handle={handle} product={backup} entry="backup" />}
      {product.status === "sold_out" && (
        <Link href={`/${handle}/${product.number}?e=number#notify`} className="text-sm text-ink-2 underline underline-offset-4">
          Text me when #{product.number} is back
        </Link>
      )}
    </div>
  );
}

function QuickCard({ handle, product, entry }: { handle: string; product: PublicProduct; entry: "number" | "backup" }) {
  return (
    <article className="mt-4 rounded-2xl bg-sheet p-4 shadow-[inset_0_0_0_1px_var(--color-rule)]">
      <div className="mb-4 flex gap-3">
        <ProductImage src={product.imageUrl} alt={product.name} size={76} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="num text-2xl font-semibold">#{product.number}</span>
            <Price priceCents={product.priceCents} salePriceCents={product.salePriceCents} className="text-lg" />
          </div>
          <h2 className="mt-0.5 text-lg leading-snug font-semibold">{product.name}</h2>
        </div>
      </div>
      <BuyButtons product={product} entry={entry} size="lg" />
      <Link href={`/${handle}/${product.number}?e=${entry}`} className="mt-3 block text-center text-sm text-ink-2 underline underline-offset-4">
        More about #{product.number}
      </Link>
    </article>
  );
}
