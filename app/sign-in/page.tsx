import { AuthForm } from "@/components/auth/auth-form";
import { AuthPage } from "@/components/ui/simple-page";
export const metadata = { title: "Sign in | Chess Coach" };
export default function SignInPage() {
  return <AuthPage title="Sign in" description="Continue reviewing your games and learning from your moves."><AuthForm mode="sign-in" /></AuthPage>;
}
