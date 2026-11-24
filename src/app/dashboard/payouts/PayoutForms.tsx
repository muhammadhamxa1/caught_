"use client";

import { useActionState, useState } from "react";
import { requestPayoutAction, savePayoutMethodAction, type PayoutFormState } from "../_actions/payouts";
import { ActionForm } from "@/components/ActionForm";

function Message({ state }: { state: PayoutFormState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`rounded-lg bg-sunk px-3 py-2 text-sm ${state.error ? "text-alert" : ""}`}>
      {state.error ?? state.message}
    </p>
  );
}

export function RequestForm({
  availableCents,
  idempotencyKey,
  disabled,
  method,
}: {
  availableCents: number;
  idempotencyKey: string;
  disabled: boolean;
  method: string | null;
}) {
  const [state, action, pending] = useActionState<PayoutFormState, FormData>(requestPayoutAction, null);
  return (
    <ActionForm action={action} className="grid gap-3">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className="label mb-0" htmlFor="amount">
        Amount
      </label>
      <div className="flex items-center rounded-[10px] bg-sheet shadow-[inset_0_0_0_1px_var(--color-rule-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)]">
        <span className="num pl-3 text-ink-3">$</span>
        <input
          id="amount"
          name="amount"
          inputMode="decimal"
          defaultValue={availableCents > 0 ? (availableCents / 100).toFixed(2) : ""}
          className="num h-12 min-w-0 flex-1 bg-transparent px-2 text-lg outline-none"
        />
      </div>
      {method && <p className="text-sm text-ink-2">Goes to {method}</p>}
      <Message state={state} />
      <button disabled={disabled || pending || state?.ok} className="btn btn-primary h-12">
        {pending ? "Requesting" : "Request payout"}
      </button>
    </ActionForm>
  );
}

export function MethodForm({ current }: { current: { type: string; label: string } | null }) {
  const [state, action, pending] = useActionState<PayoutFormState, FormData>(savePayoutMethodAction, null);
  const [type, setType] = useState(current?.type ?? "paypal");
  return (
    <ActionForm action={action} className="grid gap-3">
      {current && <p className="text-[0.9375rem]">Now: {current.label}</p>}
      <div className="flex gap-2" role="radiogroup" aria-label="Payout method">
        {[
          { v: "paypal", l: "PayPal" },
          { v: "bank", l: "Bank account" },
        ].map((o) => (
          <label key={o.v} className={`btn h-10 flex-1 cursor-pointer px-3 text-sm ${type === o.v ? "btn-primary" : "btn-quiet"}`}>
            <input type="radio" name="type" value={o.v} checked={type === o.v} onChange={() => setType(o.v)} className="sr-only" />
            {o.l}
          </label>
        ))}
      </div>
      {type === "paypal" ? (
        <input name="paypal" type="email" placeholder="PayPal email" className="field h-11" />
      ) : (
        <div className="grid grid-cols-[1fr_7rem] gap-2">
          <input name="bank" placeholder="Bank name" className="field h-11" />
          <input name="last4" inputMode="numeric" maxLength={4} placeholder="Last 4" className="field num h-11" />
        </div>
      )}
      <p className="hint">
        Caught only keeps a masked label. Full account details would sit with the payout provider, never in our database.
      </p>
      <Message state={state} />
      <button disabled={pending} className="btn btn-secondary h-11">
        {pending ? "Saving" : "Save method"}
      </button>
    </ActionForm>
  );
}
