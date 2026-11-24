import Link from "next/link";
import { Wordmark } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-sm px-5 py-16">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <h1 className="mt-10 text-2xl font-semibold">Nothing here</h1>
      <p className="mt-2 text-ink-2">Check the link in the bio. Handles look like caughtshop.com/mayafinds.</p>
      <Link href="/" className="btn btn-primary mt-6 h-12 w-full">
        Go to Caught
      </Link>
    </main>
  );
}
