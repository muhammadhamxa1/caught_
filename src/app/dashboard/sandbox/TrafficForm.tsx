"use client";

import { useActionState } from "react";
import { sendTraffic, type SandboxResult } from "../_actions/sandbox";

export function TrafficForm({ accounts, defaultId }: { accounts: { id: string; handle: string }[]; defaultId: string }) {
  const [state, action, pending] = useActionState<SandboxResult, FormData>(sendTraffic, null);
  return (
    <form action={action} className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <select name="accountId" defaultValue={defaultId} aria-label="Account" className="field h-11 w-auto">
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              @{a.handle}
            </option>
          ))}
        </select>
        <select name="count" defaultValue="25" aria-label="Visitors" className="field num h-11 w-auto">
          <option value="10">10 viewers</option>
          <option value="25">25 viewers</option>
          <option value="60">60 viewers</option>
        </select>
        <button disabled={pending} className="btn btn-primary h-11 px-5">
          {pending ? "Sending" : "Send viewers"}
        </button>
      </div>
      {state && (
        <p className="rounded-lg bg-sheet px-3 py-2 text-sm" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
