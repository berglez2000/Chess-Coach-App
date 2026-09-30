import { requireUser } from "@/lib/auth/session";
import { ChangePassword } from "@/components/auth/change-password";
export const dynamic = "force-dynamic";
export const metadata = { title: "Your account | Chess Coach" };
export default async function ProfilePage() {
  const user = await requireUser();
  return <main id="main-content" className="mx-auto max-w-5xl px-6 py-12 sm:px-10"><h1 className="text-3xl font-semibold">Your account</h1><dl className="mt-6 space-y-2"><div><dt className="font-semibold">Name</dt><dd>{user.name}</dd></div><div><dt className="font-semibold">Email</dt><dd>{user.email}</dd></div></dl><ChangePassword /></main>;
}
