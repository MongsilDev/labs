import { permanentRedirect } from "next/navigation";
import Players from "@/er/components/kel/Players";
import { playerPath } from "@/er/lib/kel";
import { kelGate, kelMetadata } from "@/er/server/kel";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("players");

// 예전 주소 ?p=이름은 선수 주소로 옮김
export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string | string[] }> }) {
  const { user, owner } = await kelGate("players");
  const { p } = await searchParams;
  const name = Array.isArray(p) ? p[0] : p;
  if (name) permanentRedirect(playerPath(name));
  return <Players user={user} owner={owner} />;
}
