"use server";

import { revalidatePath } from "next/cache";
import { parseMoney } from "@/lib/money";
import { maskEmail, requestPayout, savePayoutMethod } from "@/server/payouts";
import { requireUser } from "@/server/session";

export type PayoutFormState = { ok?: boolean; error?: string; message?: string } | null;

export async function requestPayoutAction(_prev: PayoutFormState, form: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  const amount = parseMoney(String(form.get("amount") ?? ""));
  const key = String(form.get("idempotencyKey") ?? "");
  if (amount === null) return { error: "Enter an amount, like 50.00." };
  if (key.length < 10) return { error: "Reload the page and try again." };

  const r = requestPayout(user.id, amount, key);
  if (!r.ok) return { error: r.error };
  revalidatePath("/dashboard", "layout");
  return {
    ok: true,
    message:
      r.payout.status === "approved"
        ? `${r.payout.ref} approved. It goes out with the next payment run.`
        : `${r.payout.ref} requested. First payouts get a quick manual check.`,
  };
}

export async function savePayoutMethodAction(_prev: PayoutFormState, form: FormData): Promise<PayoutFormState> {
  const user = await requireUser();
  const type = form.get("type") === "bank" ? "bank" : "paypal";

  if (type === "paypal") {
    const email = String(form.get("paypal") ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Enter the email on your PayPal account." };
    savePayoutMethod(user.id, "paypal", `PayPal ${maskEmail(email)}`);
  } else {
    const last4 = String(form.get("last4") ?? "").replace(/\D/g, "");
    const bank = String(form.get("bank") ?? "").trim().slice(0, 40);
    if (last4.length !== 4) return { error: "Enter the last 4 digits of the account." };
    savePayoutMethod(user.id, "bank", `${bank || "Bank account"} ••${last4}`);
  }
  revalidatePath("/dashboard/payouts");
  return { ok: true, message: "Payout method saved." };
}
