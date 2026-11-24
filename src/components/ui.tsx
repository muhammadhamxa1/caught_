import Link from "next/link";
import { money } from "@/lib/money";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-sans text-[1.15em] font-bold tracking-[-0.03em] ${className}`} style={{ fontVariationSettings: '"wdth" 90' }}>
      caught<span className="num text-[0.8em] font-normal">#</span>
    </span>
  );
}

export function Avatar({ name, url, size = 56 }: { name: string; url?: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-ink font-semibold text-paper"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  );
}

export function ProductImage({
  src,
  alt,
  size,
  className = "",
  muted = false,
}: {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
  muted?: boolean;
}) {
  const style = size ? { width: size, height: size } : undefined;
  if (!src) {
    return <span className={`block rounded-[10px] bg-sunk ${className}`} style={style} aria-hidden />;
  }
  return (
    // Product images come from creators and many hosts, so a plain img keeps
    // it simple. In production these go through an image CDN.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={`rounded-[10px] bg-sunk object-cover ${muted ? "opacity-50 grayscale" : ""} ${className}`}
      style={style}
    />
  );
}

export function Price({ priceCents, salePriceCents, className = "" }: { priceCents: number; salePriceCents: number | null; className?: string }) {
  const onSale = salePriceCents !== null && salePriceCents < priceCents;
  return (
    <span className={`num whitespace-nowrap ${className}`}>
      {money(onSale ? salePriceCents! : priceCents)}
      {onSale && <s className="ml-1.5 text-[0.8em] text-ink-3">{money(priceCents)}</s>}
    </span>
  );
}

/** Commission and other money that landed. The only place green is used. */
export function Earned({ cents, className = "" }: { cents: number; className?: string }) {
  return <span className={`num text-money ${className}`}>{money(cents)}</span>;
}

export function TextLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`underline decoration-rule-strong decoration-1 underline-offset-4 hover:decoration-ink ${className}`}>
      {children}
    </Link>
  );
}
