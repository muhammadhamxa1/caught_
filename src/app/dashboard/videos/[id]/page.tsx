import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products, videoProducts, videos } from "@/db/schema";
import { dashboardContext } from "@/server/scope";
import { deleteVideo } from "../../_actions/videos";
import { PageHeader } from "../../_components/bits";
import { VideoForm } from "../VideoForm";

export default async function EditVideo({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await dashboardContext();
  const { id } = await params;
  const v = db.select().from(videos).where(eq(videos.id, id)).get();
  if (!v || !ctx.accounts.some((a) => a.id === v.accountId)) notFound();

  const nums = db
    .select({ number: products.number })
    .from(videoProducts)
    .innerJoin(products, eq(products.id, videoProducts.productId))
    .where(eq(videoProducts.videoId, v.id))
    .orderBy(videoProducts.position)
    .all()
    .map((r) => r.number);

  return (
    <>
      <PageHeader title="Edit video" />
      <VideoForm
        accounts={[]}
        initial={{
          id: v.id,
          url: v.url,
          caption: v.caption,
          thumbnailUrl: v.thumbnailUrl ?? "",
          views: String(v.views),
          postedAt: v.postedAt.toISOString().slice(0, 10),
          basket: v.basket,
          numbers: nums.join(", "),
        }}
      />
      <form action={deleteVideo} className="mt-10 max-w-2xl border-t border-rule pt-6">
        <input type="hidden" name="id" value={v.id} />
        <button className="btn btn-quiet h-11 px-5">Remove this video</button>
        <p className="hint">The products stay on your page.</p>
      </form>
    </>
  );
}
