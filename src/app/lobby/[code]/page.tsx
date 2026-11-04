import { LobbyScreen } from "@/components/lobby/lobby-screen";

export default async function LobbyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LobbyScreen code={code.toUpperCase()} />;
}
