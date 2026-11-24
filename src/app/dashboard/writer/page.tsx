import { productsForAccounts } from "@/server/products";
import { dashboardContext } from "@/server/scope";
import { Empty, PageHeader } from "../_components/bits";
import { Writer } from "./Writer";

type Props = { searchParams: Promise<{ product?: string }> };

export default async function WriterPage({ searchParams }: Props) {
  const ctx = await dashboardContext();
  const multi = ctx.accounts.length > 1 && !ctx.selected;
  const options = productsForAccounts(ctx.accountIds)
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, label: `#${p.number} ${p.name}${multi ? `  @${ctx.handles.get(p.accountId)}` : ""}` }));
  const wanted = (await searchParams).product;

  return (
    <>
      <PageHeader title="Caption writer">
        Hooks, a caption, a pinned comment and a reply for &quot;link??&quot; comments. Every one says the product number, and every one is
        checked for wording that gets links pulled.
      </PageHeader>
      {options.length === 0 ? (
        <Empty>Add a product first.</Empty>
      ) : (
        <Writer options={options} initialId={options.some((o) => o.id === wanted) ? wanted : undefined} />
      )}
    </>
  );
}
