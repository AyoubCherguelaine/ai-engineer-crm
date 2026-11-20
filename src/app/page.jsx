import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "@/server/auth";
import Workspace from "@/components/crm/workspace";

export default async function Home() {
  const cookieStore = await cookies();
  if (!verifySession(cookieStore.get(SESSION_COOKIE)?.value))
    redirect("/login");
  return <Workspace />;
}
