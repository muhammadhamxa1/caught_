"use client";

import { useActionState } from "react";
import { notifyMe, type NotifyState } from "@/app/[handle]/actions";
import { ActionForm } from "@/components/ActionForm";

export function NotifyForm({ productId, number, soldOut }: { productId: string; number: number; soldOut: boolean }) {
  const [state, action, pending] = useActionState<NotifyState, FormData>(notifyMe, null);

  return (
    <ActionForm action={action} id="notify" className="scroll-mt-6">
      <input type="hidden" name="productId" value={productId} />
      <label htmlFor={`contact-${productId}`} className="label">
        {soldOut ? `Text me when #${number} is back` : "Text me when it's on sale"}
      </label>
      {state?.ok ? (
        <p className="rounded-xl bg-sunk px-4 py-3 text-[0.9375rem]">{state.message}</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              id={`contact-${productId}`}
              name="contact"
              required
              autoComplete="tel"
              placeholder="Phone or email"
              className="field h-12 min-w-0 flex-1"
            />
            <button type="submit" disabled={pending} className="btn btn-secondary h-12 shrink-0 px-4">
              {pending ? "Saving" : "Notify me"}
            </button>
          </div>
          {state && !state.ok ? (
            <p className="mt-1.5 text-sm text-alert" role="alert">
              {state.message}
            </p>
          ) : (
            <p className="hint">One message when it happens. Reply STOP any time.</p>
          )}
        </>
      )}
    </ActionForm>
  );
}
