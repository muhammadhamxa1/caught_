import Link from "next/link";

export function PageHeader({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
        {children && <div className="mt-1 max-w-[65ch] text-ink-2">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function Panel({
  title,
  note,
  children,
  className = "",
  action,
}: {
  title?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl bg-sheet p-5 shadow-[inset_0_0_0_1px_var(--color-rule)] ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {note && <p className="mt-0.5 text-sm text-ink-3">{note}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** A receipt line: label, dotted leader, value. */
export function Line({ label, children, strong = false }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline gap-2 py-1.5 ${strong ? "font-semibold" : ""}`}>
      <span className="shrink-0">{label}</span>
      <span className="leader" />
      <span className="num shrink-0 text-right">{children}</span>
    </div>
  );
}

export function RangeTabs({ days, basePath }: { days: number; basePath: string }) {
  return (
    <div className="inline-flex rounded-xl bg-sunk p-1" role="tablist" aria-label="Date range">
      {[7, 30, 90].map((d) => (
        <Link
          key={d}
          href={`${basePath}?d=${d}`}
          role="tab"
          aria-selected={d === days}
          className={`num rounded-lg px-3 py-1.5 text-sm ${d === days ? "bg-sheet font-semibold shadow-sm" : "text-ink-2 hover:text-ink"}`}
        >
          {d}d
        </Link>
      ))}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-sunk px-4 py-5 text-center text-[0.9375rem] text-ink-2">{children}</p>;
}

const STATUS_STYLE: Record<string, string> = {
  active: "shadow-[inset_0_0_0_1px_var(--color-rule-strong)] text-ink-2",
  sold_out: "bg-ink text-paper",
  archived: "bg-sunk text-ink-3",
  pending: "shadow-[inset_0_0_0_1px_var(--color-rule-strong)] text-ink-2",
  approved: "bg-sunk text-ink",
  paid: "bg-money-tint text-money",
  cleared: "bg-money-tint text-money",
  rejected: "bg-sunk text-alert",
  failed: "bg-sunk text-alert",
  reversed: "bg-sunk text-ink-3",
  live: "shadow-[inset_0_0_0_1px_var(--color-rule-strong)] text-ink-2",
  pulled: "bg-ink text-paper",
  none: "bg-sunk text-ink-3",
};

const STATUS_LABEL: Record<string, string> = {
  active: "In stock",
  sold_out: "Sold out",
  archived: "Archived",
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  cleared: "Cleared",
  rejected: "Rejected",
  failed: "Failed",
  reversed: "Refunded",
  live: "Basket live",
  pulled: "Link pulled",
  none: "No basket",
};

export function Status({ value }: { value: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STATUS_STYLE[value] ?? ""}`}>
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function rangeDays(raw: string | undefined) {
  const n = Number(raw);
  return [7, 30, 90].includes(n) ? n : 30;
}

export function shortDate(d: Date | number) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateTime(d: Date | number) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function ago(d: Date | number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(d).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
