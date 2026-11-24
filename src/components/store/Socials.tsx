const LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  amazon: "Amazon storefront",
  website: "Website",
};

export function Socials({ socials }: { socials: Record<string, string> }) {
  const entries = Object.entries(socials).filter(([k, v]) => LABELS[k] && v);
  if (entries.length === 0) return null;
  return (
    <nav aria-label="Other places to follow" className="flex flex-wrap gap-2">
      {entries.map(([key, url]) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full px-3 py-1.5 text-sm font-medium shadow-[inset_0_0_0_1px_var(--color-rule-strong)] hover:bg-sunk"
        >
          {LABELS[key]}
        </a>
      ))}
    </nav>
  );
}
