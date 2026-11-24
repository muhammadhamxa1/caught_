import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accountsFor } from "@/server/accounts";
import { feed } from "@/server/analytics";
import { SCOPE_COOKIE } from "@/server/scope";
import { currentUser } from "@/server/session";

export const dynamic = "force-dynamic";

// Polled by the dashboard every few seconds for the activity feed.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Log in" }, { status: 401 });

  const accounts = accountsFor(user.id);
  const scope = (await cookies()).get(SCOPE_COOKIE)?.value;
  const selected = accounts.find((a) => a.id === scope);
  const ids = selected ? [selected.id] : accounts.map((a) => a.id);
  const handles = new Map(accounts.map((a) => [a.id, a.handle]));

  const rows = feed(ids, handles).map((r) => ({ ...r, at: r.at.getTime() }));
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
