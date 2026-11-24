import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { currentUser } from "@/server/session";
import { SignupForm } from "../AuthForms";

export const metadata = { title: "Create your page" };

export default async function SignupPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-sm px-5 py-12">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold">Create your page</h1>
      <p className="mt-1 mb-6 text-ink-2">One link for your bio. Every product gets a number.</p>
      <SignupForm />
      <p className="mt-6 text-sm text-ink-2">
        Already have a page?{" "}
        <Link href="/login" className="underline underline-offset-4">
          Log in
        </Link>
      </p>
    </main>
  );
}
