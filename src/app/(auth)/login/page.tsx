import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/ui";
import { currentUser } from "@/server/session";
import { LoginForm } from "../AuthForms";

export const metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/dashboard");
  return (
    <main className="mx-auto max-w-sm px-5 py-12">
      <Link href="/">
        <Wordmark className="text-2xl" />
      </Link>
      <h1 className="mt-8 mb-6 text-2xl font-semibold">Log in</h1>
      <LoginForm />
      <p className="mt-6 text-sm text-ink-2">
        New here?{" "}
        <Link href="/signup" className="underline underline-offset-4">
          Create your page
        </Link>
      </p>
    </main>
  );
}
