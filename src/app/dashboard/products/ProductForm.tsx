"use client";

import { useActionState, useState, useTransition } from "react";
import { lookupCatalog, saveProduct, type ProductFormState } from "../_actions/products";
import { CATEGORIES, type ProductValues } from "./values";
import { ActionForm } from "@/components/ActionForm";

const pct = (bps?: number) => (bps ? String(bps / 100) : "");

export function ProductForm({
  initial,
  accounts,
  nextNumbers,
  samples,
}: {
  initial: ProductValues;
  accounts: { id: string; handle: string }[];
  nextNumbers?: Record<string, number>;
  samples?: { title: string; url: string }[];
}) {
  const [state, action, saving] = useActionState<ProductFormState, FormData>(saveProduct, null);
  const [v, setV] = useState(initial);
  const [link, setLink] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [looking, startLookup] = useTransition();
  const isNew = !initial.id;
  const set = (k: keyof ProductValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((prev) => ({ ...prev, [k]: e.target.value }));

  function fill(url: string) {
    setLink(url);
    setLookupError("");
    startLookup(async () => {
      const r = await lookupCatalog(url);
      if (!r.item) return setLookupError(r.error ?? "Not found.");
      const it = r.item;
      setV((prev) => ({
        ...prev,
        catalogId: it.catalogId,
        name: it.name,
        imageUrl: it.imageUrl,
        category: it.category,
        keywords: it.keywords,
        price: (it.priceCents / 100).toFixed(2),
        tiktokUrl: it.tiktokUrl,
        tiktokRate: pct(it.rateBps),
        tierRate: pct(it.tier?.rateBps),
        tierUnits: it.tier ? String(it.tier.minUnits) : "",
        brandName: it.brandName ?? "",
        brandUrl: it.brandUrl ?? "",
        brandRate: pct(it.brandRateBps),
      }));
    });
  }

  return (
    <div className="grid gap-6">
      {isNew && (
        <section className="rounded-2xl bg-sunk p-5">
          <label htmlFor="paste" className="label">
            Paste a TikTok Shop link
          </label>
          <div className="flex gap-2">
            <input
              id="paste"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://shop.tiktok.com/view/product/..."
              className="field h-11 min-w-0 flex-1"
            />
            <button type="button" onClick={() => fill(link)} disabled={!link || looking} className="btn btn-primary h-11 px-4">
              {looking ? "Looking" : "Fill in"}
            </button>
          </div>
          <p className="hint">We pull the name, price, image and commission plan from TikTok Shop.</p>
          {lookupError && <p className="mt-2 text-sm text-alert">{lookupError}</p>}
          {samples && samples.length > 0 && (
            <div className="mt-3 text-sm">
              <p className="text-ink-2">Sandbox catalog links you can try:</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {samples.map((s) => (
                  <li key={s.url}>
                    <button type="button" onClick={() => fill(s.url)} className="rounded-full bg-sheet px-3 py-1 shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-paper">
                      {s.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <ActionForm action={action} className="grid gap-6">
        {initial.id && <input type="hidden" name="id" value={initial.id} />}
        <input type="hidden" name="catalogId" value={v.catalogId} />

        {isNew && accounts.length > 1 && (
          <div>
            <label className="label" htmlFor="accountId">
              Account
            </label>
            <select id="accountId" name="accountId" value={v.accountId} onChange={set("accountId")} className="field h-11">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                </option>
              ))}
            </select>
          </div>
        )}
        {isNew && accounts.length === 1 && <input type="hidden" name="accountId" value={accounts[0].id} />}
        {isNew && v.accountId && nextNumbers?.[v.accountId] && (
          <p className="text-[0.9375rem]">
            This product will be <span className="num font-semibold">#{nextNumbers[v.accountId]}</span>. Numbers never change and are
            never reused.
          </p>
        )}

        <fieldset className="grid gap-4">
          <legend className="mb-2 text-lg font-semibold">The product</legend>
          <div>
            <label className="label" htmlFor="name">
              Name
            </label>
            <input id="name" name="name" required value={v.name} onChange={set("name")} className="field h-11" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label className="label" htmlFor="imageUrl">
                Image
              </label>
              <input id="imageUrl" name="imageUrl" value={v.imageUrl} onChange={set("imageUrl")} placeholder="Image link, or upload below" className="field h-11" />
              <input name="image" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-sunk file:px-3 file:py-2 file:font-medium" />
            </div>
            {v.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.imageUrl} alt="" className="size-24 rounded-xl bg-sunk object-cover" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="price">
                Price
              </label>
              <input id="price" name="price" inputMode="decimal" required value={v.price} onChange={set("price")} placeholder="14.99" className="field num h-11" />
            </div>
            <div>
              <label className="label" htmlFor="salePrice">
                Sale price
              </label>
              <input id="salePrice" name="salePrice" inputMode="decimal" value={v.salePrice} onChange={set("salePrice")} placeholder="Optional" className="field num h-11" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="label" htmlFor="category">
                Category
              </label>
              <select id="category" name="category" value={v.category} onChange={set("category")} className="field h-11">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c[0].toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="-mt-2 text-sm text-ink-3">Setting a sale price texts everyone waiting for a sale on this product.</p>
          <div>
            <label className="label" htmlFor="keywords">
              Search words
            </label>
            <input id="keywords" name="keywords" value={v.keywords} onChange={set("keywords")} placeholder="lip gloss, tinted, shine" className="field h-11" />
            <p className="hint">Other words viewers might type. They help search find this product.</p>
          </div>
        </fieldset>

        <fieldset className="grid gap-4">
          <legend className="mb-2 text-lg font-semibold">Where to buy</legend>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div>
              <label className="label" htmlFor="tiktokUrl">
                TikTok Shop link
              </label>
              <input id="tiktokUrl" name="tiktokUrl" required value={v.tiktokUrl} onChange={set("tiktokUrl")} className="field h-11" />
            </div>
            <div>
              <label className="label" htmlFor="tiktokRate">
                Commission %
              </label>
              <input id="tiktokRate" name="tiktokRate" inputMode="decimal" value={v.tiktokRate} onChange={set("tiktokRate")} className="field num h-11" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[0.9375rem]">
            <span>Bonus rate of</span>
            <input name="tierRate" inputMode="decimal" value={v.tierRate} onChange={set("tierRate")} aria-label="Bonus commission percent" className="field num h-10 w-20" />
            <span>% after</span>
            <input name="tierUnits" inputMode="numeric" value={v.tierUnits} onChange={set("tierUnits")} aria-label="Units per month" className="field num h-10 w-20" />
            <span>units a month, if the seller offers one.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <div>
              <label className="label" htmlFor="amazonUrl">
                Amazon link <span className="font-normal text-ink-3">(optional)</span>
              </label>
              <input id="amazonUrl" name="amazonUrl" value={v.amazonUrl} onChange={set("amazonUrl")} className="field h-11" />
            </div>
            <div>
              <label className="label" htmlFor="amazonRate">
                Commission %
              </label>
              <input id="amazonRate" name="amazonRate" inputMode="decimal" value={v.amazonRate} onChange={set("amazonRate")} className="field num h-11" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr_7rem]">
            <div>
              <label className="label" htmlFor="brandName">
                Brand name
              </label>
              <input id="brandName" name="brandName" value={v.brandName} onChange={set("brandName")} className="field h-11" />
            </div>
            <div>
              <label className="label" htmlFor="brandUrl">
                Brand site link <span className="font-normal text-ink-3">(optional)</span>
              </label>
              <input id="brandUrl" name="brandUrl" value={v.brandUrl} onChange={set("brandUrl")} className="field h-11" />
            </div>
            <div>
              <label className="label" htmlFor="brandRate">
                Commission %
              </label>
              <input id="brandRate" name="brandRate" inputMode="decimal" value={v.brandRate} onChange={set("brandRate")} className="field num h-11" />
            </div>
          </div>
        </fieldset>

        {state?.error && (
          <p role="alert" className="rounded-lg bg-sunk px-3 py-2 text-sm text-alert">
            {state.error}
          </p>
        )}
        {state?.saved && <p className="rounded-lg bg-sunk px-3 py-2 text-sm">Saved.</p>}
        <div>
          <button disabled={saving} className="btn btn-primary h-12 px-6">
            {saving ? "Saving" : isNew ? "Add product" : "Save changes"}
          </button>
        </div>
      </ActionForm>
    </div>
  );
}
