"use client";

import { useActionState } from "react";
import { addAccount, saveProfile, type SettingsState } from "../_actions/settings";
import { ActionForm } from "@/components/ActionForm";

function Message({ state }: { state: SettingsState }) {
  if (!state) return null;
  return (
    <p role={state.error ? "alert" : "status"} className={`rounded-lg bg-sunk px-3 py-2 text-sm ${state.error ? "text-alert" : ""}`}>
      {state.error ?? state.message}
    </p>
  );
}

type Account = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  socials: Record<string, string | undefined>;
};

const SOCIALS = [
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "amazon", label: "Amazon storefront" },
  { key: "website", label: "Website" },
];

export function ProfileForm({ account }: { account: Account }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveProfile, null);
  return (
    <ActionForm action={action} className="grid gap-4" key={account.id}>
      <input type="hidden" name="accountId" value={account.id} />
      <div>
        <label className="label" htmlFor="displayName">
          Name on your page
        </label>
        <input id="displayName" name="displayName" defaultValue={account.displayName} className="field h-11" />
      </div>
      <div>
        <label className="label" htmlFor="bio">
          Bio
        </label>
        <textarea id="bio" name="bio" rows={2} maxLength={200} defaultValue={account.bio} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="avatar">
          Photo
        </label>
        <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-sunk file:px-3 file:py-2 file:font-medium" />
        {account.avatarUrl && (
          <label className="mt-2 flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="removeAvatar" /> Remove current photo
          </label>
        )}
      </div>
      <fieldset className="grid gap-3">
        <legend className="label">Other places to follow you</legend>
        {SOCIALS.map((s) => (
          <div key={s.key} className="grid grid-cols-[9rem_1fr] items-center gap-3">
            <label htmlFor={s.key} className="text-sm text-ink-2">
              {s.label}
            </label>
            <input id={s.key} name={s.key} defaultValue={account.socials[s.key] ?? ""} placeholder="https://" className="field h-10" />
          </div>
        ))}
      </fieldset>
      <Message state={state} />
      <div>
        <button disabled={pending} className="btn btn-primary h-11 px-5">
          {pending ? "Saving" : "Save"}
        </button>
      </div>
    </ActionForm>
  );
}

export function AddAccountForm() {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addAccount, null);
  return (
    <ActionForm action={action} className="grid gap-3">
      <div className="flex items-center rounded-[10px] bg-sheet shadow-[inset_0_0_0_1px_var(--color-rule-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)]">
        <span className="num pl-3 text-sm text-ink-3">caughtshop.com/</span>
        <input name="handle" required aria-label="Handle" placeholder="newhandle" autoCapitalize="none" className="num h-11 min-w-0 flex-1 bg-transparent pr-3 outline-none" />
      </div>
      <input name="displayName" placeholder="Name on that page" aria-label="Name on that page" className="field h-11" />
      <Message state={state} />
      <button disabled={pending} className="btn btn-secondary h-11">
        {pending ? "Claiming" : "Claim handle"}
      </button>
    </ActionForm>
  );
}
