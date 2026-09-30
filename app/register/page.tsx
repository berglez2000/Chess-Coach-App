import { AuthForm } from "@/components/auth/auth-form";
export const metadata = { title: "Create account | Chess Coach" };
export default function RegisterPage() {
  return <main id="main-content" className="mx-auto max-w-md px-6 py-12"><h1 className="text-3xl font-semibold">Create account</h1><p className="mt-3 text-[#465c50]">Keep your games and coaching together in your account.</p><AuthForm mode="register" /></main>;
}
