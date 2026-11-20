import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfigured, SESSION_COOKIE, verifySession } from "@/server/auth";
import { LoginForm } from "@/components/crm/login-form";

export const metadata = { title: "Sign in — Reach" };
export default async function LoginPage() {
  const cookieStore = await cookies();
  if (verifySession(cookieStore.get(SESSION_COOKIE)?.value)) redirect("/");
  return <LoginForm configured={authConfigured()} />;
}
