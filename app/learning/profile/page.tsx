import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { getProfile, resourceOptions } from "@/lib/learning-profile/repository";
import { LearningProfileForm } from "@/components/learning-profile/profile-form";
export const dynamic = "force-dynamic";
export const metadata = { title: "Learning profile | Chess Coach" };
export default async function LearningProfilePage() {
  const user = await requireUser(); const db = getDb();
  const [profile, resources] = await Promise.all([getProfile(db, user.id), resourceOptions(db, user.id)]);
  return <main id="main-content" className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
    <Link href="/learning" className="text-sm underline">Return to learning</Link>
    <h1 className="mt-4 text-3xl font-semibold">Learning profile</h1>
    <p className="mt-3">Tell us what you want to improve and when you can study. You can edit your answers anytime.</p>
    <p className="mt-2 text-sm">Your profile is private to your account. Weekly planning uses the saved answers when you explicitly generate a proposal.</p>
    <p className="mt-3"><Link href="/learning/plan" className="underline">Create or review your weekly plan</Link></p>
    <LearningProfileForm key={user.id} initial={profile} resources={resources} />
  </main>;
}
