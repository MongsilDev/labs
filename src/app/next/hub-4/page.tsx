import Live from "@/next/Live";
import CodeOpen from "@/next/CodeOpen";
import HubFind from "@/next/HubFind";
import HubScore from "@/next/HubScore";
import { CutSection, KelSection, TierHead } from "@/next/HubParts";
import RowLinks from "@/next/RowLinks";
import { hubData } from "@/next/hub";
import HubSearch from "@/tarkov/components/players/HubSearch";
import "@/next/hub.css";
import "@/next/hub5.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 4" };

// 찾기 먼저. 입력칸 하나가 화면 가운데에 있고, 비어 있을 때는 점수 순 상위 5개가 그 아래 보임
export default async function Hub4() {
  const h = await hubData();
  return (
    <Live user={h.user}>
      <div className="hub-in">
        <HubFind
          combos={h.combos.map(({ char, key, name, weapon, weaponName, score }) => ({ char, key, name, weapon, weaponName, score }))}
          head={<TierHead h={h} />}
          code={<CodeOpen className="" />}
          tarkov={<HubSearch />}
        />
      </div>
      <div className="hub-in mt-14 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-x-12 lg:grid-cols-3" style={{ ["--d" as string]: 2 }}>
        <CutSection h={h} />
        <HubScore mine={h.mine} code={false} className="self-start" />
        <div className="grid content-start gap-10 md:col-span-2 md:grid-cols-2 md:gap-x-12 lg:col-span-1 lg:grid-cols-1">
          <KelSection h={h} />
          <RowLinks
            className=""
            items={[
              { href: "/er/overlay", label: "오버레이" },
              { href: "/tarkov/kord-breach", label: "KORD BREACH 특성 시뮬레이터" },
            ]}
          />
        </div>
      </div>
    </Live>
  );
}
