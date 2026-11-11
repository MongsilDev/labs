import Link from "next/link";
import Live from "@/next/Live";
import CodeOpen from "@/next/CodeOpen";
import { Chev, CutNums, KelFig, kelLead, TopFig } from "@/next/Hub5Parts";
import { hubData } from "@/next/hub";
import HubSearch from "@/tarkov/components/players/HubSearch";
import "@/next/hub.css";
import "@/next/hub5.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 1" };

// 큰 글자 목차. 기능 하나가 한 줄이고 값은 하나씩만 보임
export default async function Hub1() {
  const h = await hubData();
  const top = h.combos[0];
  const lead = kelLead(h);
  const d = (i: number) => ({ ["--d" as string]: i });
  return (
    <Live user={h.user}>
      <div className="hub1">
        <div className="hub1-row hub-in" data-size="l" style={d(0)}>
          <h2>
            <Link className="hub1-t" href="/er/tier">실험체 티어</Link>
          </h2>
          {h.view && top ? (
            <div className="hub1-v">
              <p className="hub1-k num">{h.view.label} 1위</p>
              <TopFig c={top} />
            </div>
          ) : (
            <p className="hub1-v text-ink-3">실험체 티어를 불러오지 못했습니다.</p>
          )}
          <Chev />
        </div>
        <div className="hub1-row hub-in" data-size="l" style={d(1)}>
          <h2>
            <Link className="hub1-t" href="/er/cut">이터컷</Link>
          </h2>
          {h.cut ? (
            <div className="hub1-v">
              <CutNums cut={h.cut} forecast={false} />
            </div>
          ) : (
            <p className="hub1-v text-ink-3">이터컷을 불러오지 못했습니다.</p>
          )}
          <Chev />
        </div>
        <div className="hub1-row hub-in" data-size="l" style={d(2)}>
          <h2>
            <Link className="hub1-t" href="/er/score">대회 점수</Link>
          </h2>
          <div className="hub1-v flex items-start gap-3 max-md:flex-col">
            <Link className="btn primary md:mt-[22px]" href="/er/score">새 대회 만들기</Link>
            <CodeOpen className="w-[260px] max-md:w-full" />
          </div>
          <Chev />
        </div>
        <div className="hub1-row hub-in" data-size="m" style={d(3)}>
          <h2>
            <Link className="hub1-t" href="/er/kel">2026 KEL</Link>
          </h2>
          {lead ? (
            <div className="hub1-v">
              <p className="hub1-k">{lead.stage} 1위</p>
              <KelFig lead={lead} />
            </div>
          ) : (
            <p className="hub1-v text-ink-3">KEL 기록을 불러오지 못했습니다.</p>
          )}
          <Chev />
        </div>
        <div className="hub1-row hub-in" data-size="m" style={d(4)}>
          <h2>
            <Link className="hub1-t" href="/tarkov/players">타르코프 계정 조회</Link>
          </h2>
          <div className="hub1-v w-[420px] max-md:w-full">
            <HubSearch />
          </div>
          <Chev />
        </div>
        <div className="hub1-pair hub-in" style={d(5)}>
          <div className="hub1-row" data-size="s">
            <h2>
              <Link className="hub1-t" href="/er/overlay">오버레이</Link>
            </h2>
            <Chev />
          </div>
          <div className="hub1-row" data-size="s">
            <h2>
              <Link className="hub1-t" href="/tarkov/kord-breach">KORD BREACH 특성 시뮬레이터</Link>
            </h2>
            <Chev />
          </div>
        </div>
      </div>
    </Live>
  );
}
