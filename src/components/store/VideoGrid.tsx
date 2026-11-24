"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import type { PublicProduct, PublicVideo } from "@/lib/public";
import { compact } from "@/lib/money";
import { ProductLines } from "./ProductLines";

export function VideoGrid({
  handle,
  videos,
  products,
}: {
  handle: string;
  videos: PublicVideo[];
  products: PublicProduct[];
}) {
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<PublicVideo | null>(null);
  const byId = new Map(products.map((p) => [p.id, p]));
  const shown = showAll ? videos : videos.slice(0, 9);

  return (
    <>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-3">
        {shown.map((v) => {
          const items = v.productIds.map((id) => byId.get(id)).filter(Boolean) as PublicProduct[];
          const single = items.length === 1 ? items[0] : null;
          const thumb = <Thumb video={v} numbers={items.map((p) => p.number)} />;
          return (
            <li key={v.id}>
              {single ? (
                <Link href={`/${handle}/${single.number}?e=video&v=${encodeURIComponent(v.id)}`} className="block">
                  {thumb}
                </Link>
              ) : (
                <button type="button" onClick={() => setOpen(v)} className="block w-full text-left">
                  {thumb}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {videos.length > 9 && !showAll && (
        <button type="button" onClick={() => setShowAll(true)} className="btn btn-quiet mt-4 h-11 w-full text-[0.9375rem]">
          Show all {videos.length} videos
        </button>
      )}
      {open && (
        <VideoSheet
          handle={handle}
          video={open}
          products={open.productIds.map((id) => byId.get(id)).filter(Boolean) as PublicProduct[]}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

function Thumb({ video, numbers }: { video: PublicVideo; numbers: number[] }) {
  return (
    <>
      <span className="relative block aspect-[9/16] overflow-hidden rounded-[10px] bg-ink">
        {video.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover" />
        )}
        <span className="num absolute top-1.5 left-1.5 rounded-md bg-paper px-1.5 py-0.5 text-[0.75rem] font-semibold text-ink">
          {numbers.length > 1 ? `${numbers.length} items` : `#${numbers[0]}`}
        </span>
        <span className="num absolute bottom-1.5 left-1.5 flex items-center gap-1 text-[0.75rem] text-paper">
          <Play size={11} fill="currentColor" aria-hidden />
          {compact(video.views)}
        </span>
      </span>
      <span className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink-2">{video.caption}</span>
    </>
  );
}

function VideoSheet({
  handle,
  video,
  products,
  onClose,
}: {
  handle: string;
  video: PublicVideo;
  products: PublicProduct[];
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Products in this video">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/40 animate-[fade_160ms_ease-out]" onClick={onClose} />
      <div className="relative max-h-[80dvh] w-full max-w-[34rem] overflow-y-auto rounded-t-3xl bg-paper px-5 pt-4 pb-8 animate-[rise_220ms_cubic-bezier(.2,.8,.2,1)]">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">In this video</h2>
            <p className="mt-0.5 line-clamp-2 text-sm text-ink-2">{video.caption}</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-sunk">
            <X size={20} />
          </button>
        </div>
        <ProductLines handle={handle} products={products} entry="video" videoId={video.id} />
      </div>
      <style>{`@keyframes rise{from{transform:translateY(100%)}to{transform:none}}@keyframes fade{from{opacity:0}to{opacity:1}}`}</style>
    </div>
  );
}
