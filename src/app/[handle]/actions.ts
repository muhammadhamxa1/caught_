"use server";

import { headers } from "next/headers";
import { addSignup } from "@/server/notify";
import { allow, clientIp } from "@/server/ratelimit";

export type NotifyState = { ok: boolean; message: string } | null;

export async function notifyMe(_prev: NotifyState, form: FormData): Promise<NotifyState> {
  const h = await headers();
  if (!allow(`notify:${clientIp(h)}`, 8, 10 * 60_000)) {
    return { ok: false, message: "Too many tries. Wait a few minutes and try again." };
  }

  const productId = String(form.get("productId") ?? "");
  const contact = String(form.get("contact") ?? "");
  const r = addSignup(productId, contact);
  if (!r.ok) return { ok: false, message: r.error };

  const how = r.channel === "sms" ? "text" : "email";
  return {
    ok: true,
    message: r.reason === "restock" ? `Done. One ${how} when it's back.` : `Done. One ${how} when it goes on sale.`,
  };
}
