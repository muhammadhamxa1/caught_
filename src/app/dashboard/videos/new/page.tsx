import { dashboardContext } from "@/server/scope";
import { PageHeader } from "../../_components/bits";
import { VideoForm } from "../VideoForm";

export default async function NewVideo() {
  const ctx = await dashboardContext();
  return (
    <>
      <PageHeader title="Add video">A TikTok link, a thumbnail and the product numbers are enough.</PageHeader>
      <VideoForm
        accounts={ctx.accounts.map((a) => ({ id: a.id, handle: a.handle }))}
        initial={{
          accountId: ctx.primary.id,
          url: "",
          caption: "",
          thumbnailUrl: "",
          views: "",
          postedAt: new Date().toISOString().slice(0, 10),
          basket: "live",
          numbers: "",
        }}
      />
    </>
  );
}
