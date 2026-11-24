// Shared by the bio page (runs in the browser, instant) and the server
// (logging and the traffic simulator), so both always agree on a "miss".

export type Searchable = { number: number; name: string; keywords: string; category?: string };

export type SearchResult<T> = { byNumber: boolean; exact: T | null; results: T[] };

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const stem = (w: string) => (w.length > 3 ? w.replace(/(es|s)$/, "") : w);

export function parseNumber(raw: string) {
  const q = raw.trim().replace(/^#\s*/, "");
  return /^\d{1,5}$/.test(q) ? Number(q) : null;
}

export function searchProducts<T extends Searchable>(items: T[], raw: string): SearchResult<T> {
  const n = parseNumber(raw);
  if (n !== null) {
    const exact = items.find((i) => i.number === n) ?? null;
    return { byNumber: true, exact, results: exact ? [exact] : [] };
  }

  const tokens = words(raw).map(stem);
  if (tokens.length === 0) return { byNumber: false, exact: null, results: [] };

  const scored: { item: T; score: number }[] = [];
  for (const item of items) {
    const nameWords = words(item.name).map(stem);
    const otherWords = words(`${item.keywords} ${item.category ?? ""}`).map(stem);
    let score = 0;
    let all = true;
    for (const t of tokens) {
      if (nameWords.some((w) => w.startsWith(t))) score += 3;
      else if (otherWords.some((w) => w.startsWith(t))) score += 1;
      else {
        all = false;
        break;
      }
    }
    if (all) scored.push({ item, score });
  }

  scored.sort((a, b) => b.score - a.score || b.item.number - a.item.number);
  return { byNumber: false, exact: null, results: scored.map((s) => s.item) };
}
