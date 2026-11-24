"use client";

import { useActionState } from "react";
import { login, signup, type AuthState } from "./actions";
import { ActionForm } from "@/components/ActionForm";

function ErrorLine({ state }: { state: AuthState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="rounded-lg bg-sunk px-3 py-2 text-sm text-alert">
      {state.error}
    </p>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    <div className="grid gap-6">
      <ActionForm action={action} className="grid gap-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} className="field h-12" />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field h-12" />
        </div>
        <ErrorLine state={state} />
        <button disabled={pending} className="btn btn-primary h-12">
          {pending ? "Logging in" : "Log in"}
        </button>
      </ActionForm>

      <ActionForm action={action} className="rounded-xl bg-sunk p-4">
        <input type="hidden" name="email" value="demo@caughtshop.com" />
        <input type="hidden" name="password" value="nothingslips" />
        <p className="text-sm text-ink-2">
          Demo creator: <span className="num text-ink">demo@caughtshop.com</span> / <span className="num text-ink">nothingslips</span>
        </p>
        <button disabled={pending} className="btn btn-secondary mt-3 h-11 w-full">
          Log in as the demo creator
        </button>
      </ActionForm>
    </div>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, null);
  const f = state?.fields ?? {};
  return (
    <ActionForm action={action} className="grid gap-4">
      <div>
        <label className="label" htmlFor="handle">
          Claim your handle
        </label>
        <div className="flex items-center rounded-[10px] bg-sheet shadow-[inset_0_0_0_1px_var(--color-rule-strong)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink)]">
          <span className="num pl-3 text-sm text-ink-3">caughtshop.com/</span>
          <input
            id="handle"
            name="handle"
            required
            defaultValue={f.handle}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="yourhandle"
            className="num h-12 min-w-0 flex-1 bg-transparent pr-3 outline-none"
          />
        </div>
        <p className="hint">Use your TikTok handle so viewers recognise it.</p>
      </div>
      <div>
        <label className="label" htmlFor="name">
          Name on your page
        </label>
        <input id="name" name="name" required defaultValue={f.name} className="field h-12" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={f.email} className="field h-12" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="field h-12" />
      </div>
      <ErrorLine state={state} />
      <button disabled={pending} className="btn btn-primary h-12">
        {pending ? "Creating your page" : "Create my page"}
      </button>
    </ActionForm>
  );
}
