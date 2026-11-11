import Link from "next/link";
import CutMini from "@/er/components/cut/CutMini";
import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import { Chev, CutNums, kelLead, TierBig } from "@/next/Hub5Parts";
import { TierHead, TierMissing } from "@/next/HubParts";
import { hubData } from "@/next/hub";
import HubSearch from "@/tarkov/components/players/HubSearch";
import "@/next/hub.css";
import "@/next/hub5.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 5" };

// 세 기둥. 실험체 티어, 이터컷, 대회 점수만 같은 폭으로 크게 두고 나머지 넷은 아래 한 줄
export default async function Hub5() {
  const h = await hubData();
  const lead = kelLead(h);
  return (
    <Live user={h.user}>
      <div className="hub5 hub-lg">
        <section className="hub-in">
          <TierHead h={h} />
          {h.view ? <TierBig list={h.combos.slice(0, 5)} /> : <TierMissing />}
        </section>
        <section className="hub5-cut hub-in" style={{ ["--d" as string]: 1 }}>
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
        <HubScore mine={h.mine} rows={6} className="hub-in" />
      </div>
      <div className="hub5-band hub-in" style={{ ["--d" as string]: 3 }}>
        <Link href="/er/kel">
          <b>2026 KEL</b>
          {lead && <span>1위 {lead.team.name}</span>}
          <Chev />
        </Link>
        <div>
          <h2>
            <Link href="/tarkov/players">타르코프 계정 조회</Link>
          </h2>
          <HubSearch />
        </div>
        <Link href="/er/overlay">
          <b>오버레이</b>
          <Chev />
        </Link>
        <Link href="/tarkov/kord-breach">
          <b>KORD BREACH 특성 시뮬레이터</b>
          <Chev />
        </Link>
      </div>
    </Live>
  );
}
