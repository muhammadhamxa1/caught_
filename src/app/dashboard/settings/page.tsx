import { dashboardContext } from "@/server/scope";
import { PageHeader, Panel } from "../_components/bits";
import { AddAccountForm, ProfileForm } from "./SettingsForms";

export default async function SettingsPage() {
  const ctx = await dashboardContext();
  const a = ctx.primary;

  return (
    <>
      <PageHeader title="Settings">
        {ctx.accounts.length > 1 && !ctx.selected
          ? `Editing @${a.handle}. Pick another account at the top to edit it.`
          : `Editing @${a.handle}.`}
      </PageHeader>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,40rem)_minmax(0,22rem)]">
        <Panel title={`Your page at caughtshop.com/${a.handle}`}>
          <ProfileForm
            account={{
              id: a.id,
              handle: a.handle,
              displayName: a.displayName,
              bio: a.bio,
              avatarUrl: a.avatarUrl,
              socials: a.socials as Record<string, string>,
            }}
          />
        </Panel>
        <div className="grid content-start gap-5">
          <Panel title="Another account" note="Run a second niche page under the same login. Totals and payouts combine.">
            <AddAccountForm />
          </Panel>
          <Panel title="Login">
            <p className="text-[0.9375rem]">{ctx.user.email}</p>
            <p className="mt-1 text-sm text-ink-3">
              {ctx.accounts.length} {ctx.accounts.length === 1 ? "account" : "accounts"}: {ctx.accounts.map((x) => `@${x.handle}`).join(", ")}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
