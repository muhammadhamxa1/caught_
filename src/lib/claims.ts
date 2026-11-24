// Words that tend to get a product link pulled from a video. One health
// claim is often enough, and repeat violations can freeze a creator's
// commissions. This is a heuristic list, not TikTok's official rulebook,
// so the copy says "often" and suggests safer wording instead of blocking.

export type ClaimRule = {
  id: string;
  pattern: RegExp;
  why: string;
  instead: string;
};

export const CLAIM_RULES: ClaimRule[] = [
  {
    id: "cure",
    pattern: /\b(cure[sd]?|curing|heal(s|ed|ing)?)\b/i,
    why: "Health claim. Links are often pulled for saying a product cures or heals.",
    instead: "Say what you noticed: \"my skin felt calmer\".",
  },
  {
    id: "conditions",
    pattern: /\b(acne|eczema|psoriasis|rosacea|dermatitis|hair loss|alopecia|insomnia|anxiety|depression)\b/i,
    why: "Naming a medical condition reads as a treatment claim.",
    instead: "Describe the look or feel, not the condition.",
  },
  {
    id: "treat",
    pattern: /\b(treat(s|ment|ing)?|get(s)? rid of|clears? (up )?(my )?(skin|breakouts?))\b/i,
    why: "Treatment language is a common reason for pulled links.",
    instead: "Try \"part of my routine\" or \"helps my skin look smoother\".",
  },
  {
    id: "growth",
    pattern: /\b((re)?grow(s|th)?|thicker) (my |your )?(hair|lashes|brows)\b|\bhair growth\b|\blash growth\b/i,
    why: "Growth claims on hair and lash products are high risk.",
    instead: "Say \"my lashes look longer\" and show it on camera.",
  },
  {
    id: "weight",
    pattern: /\b(lose weight|weight loss|burn(s|ing)? fat|fat burn(er|ing)|slim(ming)? down|detox)\b/i,
    why: "Weight and detox claims are restricted almost everywhere.",
    instead: "Leave results out. Talk about taste, texture or routine.",
  },
  {
    id: "medical-proof",
    pattern: /\b(fda[- ]approved|clinically proven|doctor[- ]recommended|dermatologist[- ](approved|recommended)|medical[- ]grade)\b/i,
    why: "Needs proof on file. Without it this is a misleading claim.",
    instead: "Drop it, or quote the brand's packaging exactly.",
  },
  {
    id: "guarantee",
    pattern: /\b(guarantee[sd]?|100% (results|effective|works)|permanent(ly)?|works for everyone|miracle|instant results)\b/i,
    why: "Absolute promises are treated as misleading.",
    instead: "Say \"worked for me\" instead of promising it works for everyone.",
  },
  {
    id: "medical-effect",
    pattern: /\b(anti[- ]?bacterial|kills (germs|bacteria)|boosts? (your )?immun\w*|pain relief|relieves pain|prevents?)\b/i,
    why: "Medical effects need approval the seller rarely has.",
    instead: "Describe how you use it, not what it does to your body.",
  },
];

export type ClaimHit = { id: string; match: string; index: number; why: string; instead: string };

export function checkClaims(text: string): ClaimHit[] {
  const hits: ClaimHit[] = [];
  for (const rule of CLAIM_RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : `${rule.pattern.flags}g`);
    for (const m of text.matchAll(re)) {
      hits.push({ id: rule.id, match: m[0], index: m.index ?? 0, why: rule.why, instead: rule.instead });
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}
