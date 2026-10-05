import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/ui/simple-page";
export const metadata = { title: "Create account | Chess Coach" };
export default function RegisterPage() {
  return <AuthPage title="Create account" description="Keep your games and coaching together in your account."><AuthForm mode="register" /></AuthPage>;
}
