import { AuthForm } from "@/components/auth/auth-form";
export const metadata = { title: "Sign in | Chess Coach" };
export default function SignInPage() {
  return <main id="main-content" className="mx-auto max-w-md px-6 py-12"><h1 className="text-3xl font-semibold">Sign in</h1><p className="mt-3 text-[#465c50]">Continue reviewing your games and learning from your moves.</p><AuthForm mode="sign-in" /></main>;
}
