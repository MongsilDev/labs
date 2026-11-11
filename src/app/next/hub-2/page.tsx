import Link from "next/link";
import CutMini from "@/er/components/cut/CutMini";
import { int as rp } from "@/er/lib/cut";
import { signed } from "@/er/lib/tier";
import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import HubTabs from "@/next/HubTabs";
import { CutNums, kelLead, TierBig } from "@/next/Hub5Parts";
import { TierHead, TierMissing } from "@/next/HubParts";
import RowLinks from "@/next/RowLinks";
import { hubData } from "@/next/hub";
import HubSearch from "@/tarkov/components/players/HubSearch";
import "@/next/hub.css";
import "@/next/hub5.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 2" };

// 무대 전환. 실험체 티어, 이터컷, 대회 점수 가운데 고른 하나만 크게 보이고 나머지 기능은 탭 아래 한 줄씩
export default async function Hub2() {
  const h = await hubData();
  const top = h.combos[0];
  const lead = kelLead(h);
  const et = h.cut?.tiers.eternity;
  return (
    <Live user={h.user}>
      <div className="hub-lg hub-in">
        <HubTabs
          tabs={[
            {
              id: "tier",
              label: "실험체 티어",
              note: top ? `1위 ${top.weaponName} ${top.name} ${signed(top.score)}` : undefined,
              panel: (
                <section>
                  <TierHead h={h} />
                  {h.view ? <TierBig list={h.combos.slice(0, 5)} stats /> : <TierMissing />}
                </section>
              ),
            },
            {
              id: "cut",
              label: "이터컷",
              note: et?.cut != null ? `이터니티 ${et.estimated ? "약 " : ""}${rp(et.cut)}` : undefined,
              panel: (
                <section className="hub2-cut">
                  <h2 className="sec-h">
                    <Link href="/er/cut">이터컷</Link>
                    {h.cut && <small>{h.cut.season.name}</small>}
                    <Link className="more" href="/er/cut">내 RP 진단</Link>
                  </h2>
                  {h.cut ? (
                    <>
                      <CutNums cut={h.cut} />
                      <CutMini data={h.cut} />
                    </>
                  ) : (
                    <p className="py-3 text-ink-3">이터컷을 불러오지 못했습니다.</p>
                  )}
                </section>
              ),
            },
            {
              id: "score",
              label: "대회 점수",
              note: h.mine.length ? `내 대회 ${h.mine.length}개` : undefined,
              panel: <HubScore mine={h.mine} rows={6} big className="border-t-0! pt-0!" />,
            },
          ]}
        >
          <RowLinks className="" items={[{ href: "/er/kel", label: "2026 KEL", note: lead ? `1위 ${lead.team.name}` : undefined }]} />
          <div className="border-b border-rule py-4">
            <h2 className="lbl">
              <Link href="/tarkov/players">타르코프 계정 조회</Link>
            </h2>
            <HubSearch />
          </div>
          <RowLinks
            className="border-t-0!"
            items={[
              { href: "/er/overlay", label: "오버레이" },
              { href: "/tarkov/kord-breach", label: "KORD BREACH 특성 시뮬레이터" },
            ]}
          />
        </HubTabs>
      </div>
    </Live>
  );
}
