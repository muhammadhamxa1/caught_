import Link from "next/link";
import { Wordmark } from "@/components/ui";

const LEAKS = [
  { leak: "\"link??\" comments", fix: "They type the number on your page and buy" },
  { leak: "Pulled basket links", fix: "The number still works, the video keeps earning" },
  { leak: "Sold out products", fix: "Your backup pick shows up instead" },
  { leak: "Viewers who trust Amazon", fix: "Your Amazon link, right under TikTok Shop" },
  { leak: "Searches that find nothing", fix: "You see them, and know what to link next" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-5 pb-16">
      <header className="flex items-center justify-between py-5">
        <Wordmark className="text-2xl" />
        <nav className="flex items-center gap-2 text-[0.9375rem]">
          <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-sunk">
            Log in
          </Link>
          <Link href="/signup" className="btn btn-primary h-10 px-4">
            Create your page
          </Link>
        </nav>
      </header>

      <section className="pt-14 pb-16 sm:pt-24">
        <h1 className="max-w-[16ch] text-[3rem] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[5.5rem]">
          &ldquo;it&apos;s <span className="num font-semibold tracking-[-0.06em]">#47</span> in my bio&rdquo;
        </h1>
        <p className="mt-7 max-w-[54ch] text-lg leading-relaxed text-ink-2">
          A link in bio built for TikTok Shop affiliates. Every product gets a short number. Viewers type it and buy on TikTok Shop, Amazon or
          the brand&apos;s site, and you get the credit either way.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/mayafinds" className="btn btn-primary h-12 px-6">
            Open a demo page
          </Link>
          <Link href="/login" className="btn btn-secondary h-12 px-6">
            See the creator side
          </Link>
        </div>
      </section>

      <section aria-labelledby="leaks" className="max-w-2xl">
        <div className="lift">
          <div className="torn bg-sheet px-6 pt-6 pb-10 sm:px-8">
            <h2 id="leaks" className="text-lg font-semibold">
              Where sales slip today, and what Caught does
            </h2>
            <hr className="perf my-4" />
            <ul className="grid gap-3">
              {LEAKS.map((l) => (
                <li key={l.leak} className="grid gap-0.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
                  <span className="font-medium">{l.leak}</span>
                  <span className="text-ink-2">{l.fix}</span>
                </li>
              ))}
            </ul>
            <hr className="perf my-5" />
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">Nothing slips.</span>
              <span className="num text-sm text-ink-3">caughtshop.com</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
