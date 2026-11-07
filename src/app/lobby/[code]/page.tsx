import { LobbyScreen } from "@/components/lobby/lobby-screen";
import { accessCookieName, isAccessGranted } from "@/server/access-gate";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const cookieStore = await cookies();
  if (!isAccessGranted(cookieStore.get(accessCookieName)?.value)) redirect("/");
  const { code } = await params;
  return <LobbyScreen code={code.toUpperCase()} />;
}
