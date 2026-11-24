import { cookies } from "next/headers";
import { accountsFor } from "./accounts";
import { settleDue } from "./commissions";
import { requireUser } from "./session";

export const SCOPE_COOKIE = "caught_scope";

/**
 * Everything a dashboard page needs to know about who is looking and which
 * account they picked. "All accounts" is the default when a creator runs
 * more than one niche account.
 */
export async function dashboardContext() {
  const user = await requireUser();
  // stands in for the cron job that clears commissions after the return window
  settleDue();

  const accounts = accountsFor(user.id);
  const scope = (await cookies()).get(SCOPE_COOKIE)?.value;
  const selected = accounts.length === 1 ? accounts[0] : (accounts.find((a) => a.id === scope) ?? null);
  const accountIds = selected ? [selected.id] : accounts.map((a) => a.id);
  const handles = new Map(accounts.map((a) => [a.id, a.handle]));
  const primary = selected ?? accounts[0];

  return { user, accounts, selected, accountIds, handles, primary };
}

export type DashboardContext = Awaited<ReturnType<typeof dashboardContext>>;
