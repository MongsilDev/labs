import Link from "next/link";
import Live from "@/next/Live";
import CodeOpen from "@/next/CodeOpen";
import { Chev, CutNums, KelFig, kelLead, TopFig } from "@/next/Hub5Parts";
import RowLinks from "@/next/RowLinks";
import ScorePreview from "@/next/ScorePreview";
import { hubData } from "@/next/hub";
import HubSearch from "@/tarkov/components/players/HubSearch";
import "@/next/hub.css";
import "@/next/hub5.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 3" };

// 도구 먼저. 대회 점수를 예시 순위표와 함께 맨 위에 두고 통계는 값 하나씩 한 줄로 줄임
export default async function Hub3() {
  const h = await hubData();
  const top = h.combos[0];
  const lead = kelLead(h, true);
  return (
    <Live user={h.user}>
      <div className="hub3-hero hub-in">
        <section aria-labelledby="hub-score-h">
          <h2 id="hub-score-h" className="hub3-h">
            <Link href="/er/score">대회 점수</Link>
          </h2>
          <div className="mt-7 flex items-start gap-3 max-sm:flex-col">
            <Link className="btn primary sm:mt-[22px]" href="/er/score">새 대회 만들기</Link>
            <CodeOpen className="w-[260px] max-sm:w-full" />
          </div>
          {h.mine.length > 0 && <RowLinks className="mt-1" items={h.mine.map((m) => ({ href: `/er/t/${m.code}/a`, label: m.name, note: m.code }))} />}
        </section>
        <div className="hub3-shot">
          <ScorePreview rows={8} big label="예시" />
          <Link className="hub3-more" href="/er/example/a">
            예시 대회
            <Chev />
          </Link>
        </div>
      </div>

      <div className="hub3-strip hub-in" style={{ ["--d" as string]: 2 }}>
        <Link href="/er/tier">
          <span className="hub3-k num">실험체 티어{h.view ? ` ${h.view.label} 1위` : ""}</span>
          {top ? <TopFig c={top} /> : <span className="text-ink-3">실험체 티어를 불러오지 못했습니다.</span>}
        </Link>
        <Link href="/er/cut">
          <span className="hub3-k">이터컷</span>
          {h.cut ? <CutNums cut={h.cut} forecast={false} /> : <span className="text-ink-3">이터컷을 불러오지 못했습니다.</span>}
        </Link>
        <Link href="/er/kel">
          <span className="hub3-k">2026 KEL{lead ? ` ${lead.stage} 1위` : ""}</span>
          {lead ? <KelFig lead={lead} /> : <span className="text-ink-3">KEL 기록을 불러오지 못했습니다.</span>}
        </Link>
      </div>

      <div className="hub3-foot hub-in" style={{ ["--d" as string]: 3 }}>
        <div>
          <h2 className="lbl">
            <Link href="/tarkov/players">타르코프 계정 조회</Link>
          </h2>
          <HubSearch />
        </div>
        <RowLinks
          className="hub-last"
          items={[
            { href: "/er/overlay", label: "오버레이" },
            { href: "/tarkov/kord-breach", label: "KORD BREACH 특성 시뮬레이터" },
          ]}
        />
      </div>
    </Live>
  );
}
