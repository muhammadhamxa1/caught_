import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { products, videoProducts, videos } from "@/db/schema";
import { compact } from "@/lib/money";
import { dashboardContext } from "@/server/scope";
import { checkClaims } from "@/lib/claims";
import { Empty, PageHeader, Status, shortDate } from "../_components/bits";

type Props = { searchParams: Promise<{ saved?: string }> };

export default async function VideosPage({ searchParams }: Props) {
  const ctx = await dashboardContext();
  const saved = (await searchParams).saved;
  const list = db.select().from(videos).where(inArray(videos.accountId, ctx.accountIds)).orderBy(desc(videos.postedAt)).all();
  const links = list.length
    ? db
        .select({ videoId: videoProducts.videoId, number: products.number, position: videoProducts.position })
        .from(videoProducts)
        .innerJoin(products, eq(products.id, videoProducts.productId))
        .where(inArray(videoProducts.videoId, list.map((v) => v.id)))
        .all()
    : [];
  const multi = ctx.accounts.length > 1 && !ctx.selected;
  const pulled = list.filter((v) => v.basket === "pulled").length;

  return (
    <>
      <PageHeader
        title="Videos"
        action={
          <Link href="/dashboard/videos/new" className="btn btn-primary h-11 px-5">
            Add video
          </Link>
        }
      >
        Viewers tap a video on your page to get its products. Videos whose TikTok link was pulled keep earning here.
        {pulled > 0 && ` ${pulled} of yours are in that state right now.`}
      </PageHeader>

      {saved && <p className="mb-5 rounded-xl bg-sunk px-4 py-3">Saved.</p>}

      {list.length === 0 ? (
        <Empty>
          No videos yet.{" "}
          <Link href="/dashboard/videos/new" className="underline underline-offset-4">
            Add one
          </Link>{" "}
          and connect it to a product number.
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {list.map((v) => {
            const nums = links
              .filter((l) => l.videoId === v.id)
              .sort((a, b) => a.position - b.position)
              .map((l) => l.number);
            const flags = checkClaims(v.caption);
            return (
              <li key={v.id}>
                <Link href={`/dashboard/videos/${v.id}`} className="flex gap-4 rounded-2xl bg-sheet p-3 shadow-[inset_0_0_0_1px_var(--color-rule)] hover:bg-sunk/40">
                  <span className="relative block aspect-[9/16] w-20 shrink-0 overflow-hidden rounded-lg bg-ink">
                    {v.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnailUrl} alt="" className="size-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 py-1">
                    <span className="line-clamp-2 leading-snug font-medium">{v.caption || "No caption"}</span>
                    <span className="num mt-1 block text-sm text-ink-2">{nums.map((n) => `#${n}`).join("  ")}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
                      <Status value={v.basket} />
                      <span className="num">{compact(v.views)} views</span>
                      <span>{shortDate(v.postedAt)}</span>
                      {multi && <span>@{ctx.handles.get(v.accountId)}</span>}
                    </span>
                    {flags.length > 0 && (
                      <span className="mt-2 block text-sm text-alert">
                        Caption has &quot;{flags[0].match}&quot;, a phrase that often gets links pulled
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
