import Link from "next/link";
import CutMini from "@/er/components/cut/CutMini";
import { int as rp } from "@/er/lib/cut";
import { signed } from "@/er/lib/tier";
import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import HubTabs from "@/next/HubTabs";
import { CutNums, kelLead, KelBig, OverlayOpen, TarkovGroup, TierBig } from "@/next/Hub5Parts";
import { KelHead, n, TierHead, TierMissing } from "@/next/HubParts";
import { hubData } from "@/next/hub";
import "@/next/hub.css";
import "@/next/hub5.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 2" };

// 무대 전환. 탭은 위쪽 메뉴의 묶음(실험체, 랭크, 대회)이고 고른 묶음의 기능만 크게 보임. 타르코프는 탭 아래에 따로 묶음
export default async function Hub2() {
  const h = await hubData();
  const top = h.combos[0];
  const lead = kelLead(h, true);
  const et = h.cut?.tiers.eternity;
  return (
    <Live user={h.user}>
      <div className="hub-lg hub-in">
        <HubTabs
          tabs={[
            {
              id: "tier",
              label: "실험체",
              note: top ? `1위 ${top.weaponName} ${top.name} ${signed(top.score)}` : undefined,
              panel: (
                <section>
                  <TierHead h={h} />
                  {h.view ? <TierBig list={h.combos.slice(0, 5)} stats /> : <TierMissing />}
                </section>
              ),
            },
            {
              id: "rank",
              label: "랭크",
              note: et?.cut != null ? `이터니티 ${n(et.place)}위 ${et.estimated ? "약 " : ""}${rp(et.cut)}` : undefined,
              panel: (
                <>
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
                  <section>
                    <h2 className="sec-h">
                      <Link href="/er/overlay">오버레이</Link>
                    </h2>
                    <OverlayOpen />
                  </section>
                </>
              ),
            },
            {
              id: "event",
              label: "대회",
              note: lead ? `2026 KEL 1위 ${lead.team.name} ${lead.total}` : undefined,
              panel: (
                <>
                  <section>
                    <KelHead h={h} />
                    <KelBig h={h} rows={3} />
                  </section>
                  <HubScore mine={h.mine} preview={false} />
                </>
              ),
            },
          ]}
        >
          <TarkovGroup />
        </HubTabs>
      </div>
    </Live>
  );
}
