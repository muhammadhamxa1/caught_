"use client";

import { useState } from "react";

export function ShareButtons({ receiptId }: { receiptId: string }) {
  const [copied, setCopied] = useState(false);
  const image = `/r/${receiptId}/card`;

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // closed the share sheet, fall back to copy
      }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mt-6 grid grid-cols-2 gap-2">
      <button type="button" onClick={share} className="btn btn-primary h-12">
        {copied ? "Link copied" : "Share"}
      </button>
      <a href={image} download={`caught-${receiptId}.png`} className="btn btn-secondary h-12">
        Save image
      </a>
    </div>
  );
}
