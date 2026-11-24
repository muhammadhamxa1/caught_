"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { setScope } from "../_actions/scope";

const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/videos", label: "Videos" },
  { href: "/dashboard/earnings", label: "Earnings" },
  { href: "/dashboard/payouts", label: "Payouts" },
  { href: "/dashboard/writer", label: "Caption writer" },
  { href: "/dashboard/settings", label: "Settings" },
  { href: "/dashboard/sandbox", label: "Sandbox" },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
}

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="grid gap-0.5">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(pathname, l.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-2 text-[0.9375rem] ${
            isActive(pathname, l.href) ? "bg-ink font-semibold text-paper" : "text-ink-2 hover:bg-sunk hover:text-ink"
          } ${l.href.endsWith("sandbox") ? "mt-4" : ""}`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function TabNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="-mx-5 flex gap-1 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          aria-current={isActive(pathname, l.href) ? "page" : undefined}
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm ${
            isActive(pathname, l.href) ? "bg-ink font-semibold text-paper" : "text-ink-2 shadow-[inset_0_0_0_1px_var(--color-rule-strong)]"
          }`}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

export function AccountSwitcher({
  accounts,
  selectedId,
}: {
  accounts: { id: string; handle: string }[];
  selectedId: string | null;
}) {
  const [pending, start] = useTransition();
  if (accounts.length < 2) {
    return <span className="text-[0.9375rem] font-semibold">@{accounts[0]?.handle}</span>;
  }
  return (
    <label className="block">
      <span className="sr-only">Account</span>
      <select
        value={selectedId ?? "all"}
        disabled={pending}
        onChange={(e) => start(() => setScope(e.target.value))}
        className="field h-10 cursor-pointer py-0 text-[0.9375rem] font-semibold"
      >
        <option value="all">All accounts ({accounts.length})</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            @{a.handle}
          </option>
        ))}
      </select>
    </label>
  );
}
