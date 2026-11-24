"use client";

import { useActionState, useState } from "react";
import { checkClaims } from "@/lib/claims";
import { saveVideo, type VideoFormState } from "../_actions/videos";
import { ActionForm } from "@/components/ActionForm";

export type VideoValues = {
  id?: string;
  accountId?: string;
  url: string;
  caption: string;
  thumbnailUrl: string;
  views: string;
  postedAt: string;
  basket: string;
  numbers: string;
};

export function VideoForm({ initial, accounts }: { initial: VideoValues; accounts: { id: string; handle: string }[] }) {
  const [state, action, pending] = useActionState<VideoFormState, FormData>(saveVideo, null);
  const [caption, setCaption] = useState(initial.caption);
  const flags = checkClaims(caption);

  return (
    <ActionForm action={action} className="grid max-w-2xl gap-5">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      {!initial.id &&
        (accounts.length > 1 ? (
          <div>
            <label className="label" htmlFor="accountId">
              Account
            </label>
            <select id="accountId" name="accountId" defaultValue={initial.accountId} className="field h-11">
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  @{a.handle}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="accountId" value={accounts[0]?.id} />
        ))}

      <div>
        <label className="label" htmlFor="url">
          TikTok video link
        </label>
        <input id="url" name="url" required defaultValue={initial.url} placeholder="https://www.tiktok.com/@you/video/..." className="field h-11" />
      </div>

      <div>
        <label className="label" htmlFor="numbers">
          Product numbers in this video
        </label>
        <input id="numbers" name="numbers" required defaultValue={initial.numbers} placeholder="47, 43" className="field num h-11" />
        <p className="hint">The first number is the one shown on the video&apos;s tile.</p>
      </div>

      <div>
        <label className="label" htmlFor="caption">
          Caption
        </label>
        <textarea id="caption" name="caption" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} className="field" />
        {flags.length > 0 && (
          <div className="mt-2 rounded-lg bg-sunk px-3 py-2 text-sm" role="status">
            {flags.map((f) => (
              <p key={`${f.id}-${f.index}`}>
                <span className="font-semibold">&quot;{f.match}&quot;</span>: {f.why} {f.instead}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="postedAt">
            Posted on
          </label>
          <input id="postedAt" name="postedAt" type="date" defaultValue={initial.postedAt} className="field h-11" />
        </div>
        <div>
          <label className="label" htmlFor="views">
            Views
          </label>
          <input id="views" name="views" inputMode="numeric" defaultValue={initial.views} className="field num h-11" />
        </div>
        <div>
          <label className="label" htmlFor="basket">
            TikTok basket link
          </label>
          <select id="basket" name="basket" defaultValue={initial.basket} className="field h-11">
            <option value="live">Live</option>
            <option value="pulled">Pulled by TikTok</option>
            <option value="none">Never attached</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="thumbnailUrl">
          Thumbnail
        </label>
        <input id="thumbnailUrl" name="thumbnailUrl" defaultValue={initial.thumbnailUrl} placeholder="Image link, or upload below" className="field h-11" />
        <input name="thumbnail" type="file" accept="image/png,image/jpeg,image/webp" className="mt-2 block w-full text-sm text-ink-2 file:mr-3 file:rounded-lg file:border-0 file:bg-sunk file:px-3 file:py-2 file:font-medium" />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-sunk px-3 py-2 text-sm text-alert">
          {state.error}
        </p>
      )}
      <div>
        <button disabled={pending} className="btn btn-primary h-12 px-6">
          {pending ? "Saving" : initial.id ? "Save video" : "Add video"}
        </button>
      </div>
    </ActionForm>
  );
}
