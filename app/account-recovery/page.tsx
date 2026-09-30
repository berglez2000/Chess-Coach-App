import Link from "next/link";
export default function RecoveryPage() {
  return <main id="main-content" className="mx-auto max-w-lg px-6 py-12"><h1 className="text-3xl font-semibold">Recover your account</h1><p className="mt-5">This personal installation uses local password recovery. Ask the person running Chess Coach to reset your password using the account-recovery instructions in the README.</p><p className="mt-3">Your games will stay with your account. You will need to sign in again on every device.</p><Link href="/sign-in" className="mt-6 inline-block underline">Back to sign in</Link></main>;
}
