import { z } from "zod";
import { config } from "@/lib/config";
import { money } from "@/lib/money";
import { localKit, type Kit, type WriterProduct } from "./captions";
import { checkClaims, type ClaimHit } from "@/lib/claims";

export type WriterResult = Kit & { source: "local" | "model"; flags: ClaimHit[] };

const kitSchema = z.object({
  hooks: z.array(z.string().min(3).max(140)).min(1).max(5),
  caption: z.string().min(10).max(400),
  pinnedComment: z.string().min(5).max(200),
  linkReply: z.string().min(2).max(140),
  hashtags: z.array(z.string()).max(6).default([]),
});

function flagsFor(kit: Kit) {
  return checkClaims([...kit.hooks, kit.caption, kit.pinnedComment, kit.linkReply].join("\n"));
}

/**
 * Optional model mode. Works with any OpenAI compatible endpoint, so a
 * reviewer can point it at a local Ollama for free. Any error falls back
 * to the built in writer, the page never breaks because a model is down.
 */
async function modelKit(p: WriterProduct, handle: string): Promise<Kit | null> {
  const { url, key, model } = config.writer;
  if (!url || !model) return null;

  const facts = [
    `Product: ${p.name}`,
    `Number on the creator's Caught page: #${p.number}`,
    `Price: ${money(p.priceCents)}`,
    p.salePriceCents ? `On sale for: ${money(p.salePriceCents)}` : null,
    `Category: ${p.category}`,
    `Creator page: caughtshop.com/${handle}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Write TikTok copy for an affiliate creator.\n${facts}\n\nRules: lowercase casual voice, no health or medical claims, no promises of results, no "guaranteed", mention the number like "#${p.number} in my bio". Return JSON with keys hooks (3 short opening lines), caption, pinnedComment, linkReply (reply to people commenting "link??"), hashtags (3, no # sign).`;

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const json = JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
    return kitSchema.parse(json);
  } catch {
    return null;
  }
}

export async function writeKit(p: WriterProduct, handle: string, seed = 1): Promise<WriterResult> {
  const fromModel = seed > 0 ? await modelKit(p, handle) : null;
  const kit = fromModel ?? localKit(p, handle, seed);
  return { ...kit, source: fromModel ? "model" : "local", flags: flagsFor(kit) };
}

export { checkClaims };
