import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { dashboardContext } from "@/server/scope";
import { logout } from "../(auth)/actions";
import { AccountSwitcher, SideNav, TabNav } from "./_components/Nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard", robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, accounts, selected, primary } = await dashboardContext();
  const switcher = <AccountSwitcher accounts={accounts.map((a) => ({ id: a.id, handle: a.handle }))} selectedId={selected?.id ?? null} />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[90rem]">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-rule px-4 py-6 lg:flex">
        <Link href="/dashboard" className="px-3">
          <Wordmark className="text-xl" />
        </Link>
        <div className="mt-6 px-1">{switcher}</div>
        <div className="mt-5 flex-1">
          <SideNav />
        </div>
        <div className="grid gap-1 border-t border-rule pt-4 text-sm">
          {primary && (
            <Link href={`/${primary.handle}`} target="_blank" className="rounded-lg px-3 py-2 text-ink-2 hover:bg-sunk hover:text-ink">
              View caughtshop.com/{primary.handle}
            </Link>
          )}
          <form action={logout}>
            <button className="w-full rounded-lg px-3 py-2 text-left text-ink-2 hover:bg-sunk hover:text-ink">
              Log out {user.email}
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b border-rule px-5 pt-4 pb-3 lg:hidden">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Link href="/dashboard">
              <Wordmark className="text-xl" />
            </Link>
            <div className="max-w-[60%]">{switcher}</div>
          </div>
          <TabNav />
        </header>
        <main className="px-5 py-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
