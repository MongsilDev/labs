import { notFound, permanentRedirect } from "next/navigation";
import Players from "@/er/components/kel/Players";
import { playerPath } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { playerStats } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ name: string }> };

const find = async ({ params }: Props) => {
  const raw = (await params).name;
  const name = /%[0-9A-Fa-f]{2}/.test(raw) ? decodeURIComponent(raw) : raw;
  const data = kelData();
  const all = data ? playerStats(data) : [];
  return { name, found: all.find((p) => p.name === name) ?? all.find((p) => p.name.toLowerCase() === name.toLowerCase()) };
};

export async function generateMetadata(props: Props) {
  const { found } = await find(props);
  const meta = await kelMetadata("players");
  return found && meta.title ? { ...meta, title: `${found.name} 선수 카드` } : meta;
}

// 대소문자만 다르게 적은 주소는 기록에 있는 이름으로 옮김
export default async function Page(props: Props) {
  const { user, owner } = await kelGate("players");
  const { name, found } = await find(props);
  if (!found) notFound();
  if (found.name !== name) permanentRedirect(playerPath(found.name));
  return <Players user={user} owner={owner} name={found.name} />;
}
