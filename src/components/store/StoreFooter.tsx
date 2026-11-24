import Link from "next/link";
import { Wordmark } from "@/components/ui";

export function StoreFooter({ firstName }: { firstName: string }) {
  return (
    <footer className="mt-12">
      <hr className="perf" />
      <p className="mt-4 text-[0.8125rem] leading-relaxed text-ink-3">
        These are affiliate links. {firstName} earns a commission when you buy, at no extra cost to you.
      </p>
      <Link href="/" className="mt-5 flex items-baseline justify-between text-ink-2">
        <Wordmark />
        <span className="text-sm">Nothing slips.</span>
      </Link>
    </footer>
  );
}
