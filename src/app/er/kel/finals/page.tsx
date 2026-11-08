import FlowChart from "@/er/components/kel/FlowChart";
import KelPage, { KelScroll, KelTabs, NO_DATA } from "@/er/components/kel/KelPage";
import { TeamName } from "@/er/components/kel/Team";
import { fmt } from "@/er/lib/format";
import { EVENT_NAME, KEL_SCREENS, TEAM, TONES } from "@/er/lib/kel";
import { gameScore, standings } from "@/er/lib/kel-calc";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { scoreStages } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("finals");

// 탭 키는 결승이면 대회 키, 준결승이면 대회 키 뒤에 -semi
const NOTES: Partial<Record<string, string>> = {
  c2: "전남 이스포츠의 4라운드 점수는 bori.wiki 결과 표보다 2점 낮지만, 이유를 찾지 못해 경기 기록에 있는 값을 그대로 썼습니다.",
};

// 휴대폰 폭에서는 고리가 칸 폭을 늘리거나 옆 칸 숫자에 겹치지 않게 숫자 위에 띄움
const Ring = ({ color }: { color: string }) => (
  <span
    className="inline-block size-[9px] flex-none rounded-full border-2 max-[760px]:absolute max-[760px]:-top-[8px] max-[760px]:left-1/2 max-[760px]:size-[6px] max-[760px]:-translate-x-1/2 max-[760px]:border-[1.5px]"
    style={{ borderColor: color }}
    aria-hidden="true"
  />
);

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { user, owner } = await kelGate("finals");
  const q = await searchParams;
  const data = kelData();
  const list = data ? scoreStages(data) : [];
  const f = list.find((x) => x.key === q.f) ?? list.at(-1);
  if (!f) return <KelPage user={user} owner={owner} screen="finals" missing={NO_DATA} />;

  const { state, rounds, teams, qualify } = f;
  const semi = f.stage === "준결승";
  const played = state.played;
  const steps = Array.from({ length: played + 1 }, (_, i) => standings(teams, rounds.slice(0, i)));
  const order = steps.map((s) => s.map((r) => r.key));
  const cum = Object.fromEntries(teams.map((k) => [k, steps.map((s) => s.find((r) => r.key === k)!.total)]));
  const champ = state.champion;
  const focus = state.rows.slice(0, 2).map((r) => r.key);
  const name = (k: string) => TEAM.get(k)!.name;
  const held = (k: string, r: number) => state.holders[r]?.includes(k);

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="finals"
      notes={[
        state.rows.some((r) => r.penalty > 0) && "감점 열에는 경기 기록으로 계산한 점수에서 뺀 감점을 표시합니다.",
        f.weather.some(Boolean) && "라운드 번호 아래 글자는 그 라운드의 메인 날씨입니다.",
        NOTES[f.key],
      ]}
      narrowNotes={[NOTES[f.key]]}
    >
      <KelTabs
        label="경기"
        items={list.map((x) => [x.key, `${EVENT_NAME[x.event]} ${x.stage}`] as const)}
        current={f.key}
        href={(k) => (k === list.at(-1)!.key ? KEL_SCREENS.finals.path : `${KEL_SCREENS.finals.path}?f=${k}`)}
      />
      {/* 넓은 화면은 표 옆에 그래프를 두어 첫 화면에 함께 보이게 함 */}
      <div className="grid grid-cols-1 gap-5 min-[1280px]:grid-cols-[auto_minmax(0,1fr)] min-[1280px]:items-start">
        <section className="panel p-5 max-[760px]:px-3 max-[760px]:py-4" aria-labelledby="round-scores">
          {/* 페이지 제목과 같은 말이라 화면에서는 숨김 */}
          <h2 id="round-scores" className="sr-only">
            라운드별 점수
          </h2>
          <p className="text-[13px] text-fg-3">
            굵은 숫자는 그 라운드에서 1위를 차지한 팀의 점수입니다.
          </p>
          <KelScroll label="라운드별 점수" className="mt-3">
            <table className="kel-table kel-rounds">
              <thead>
                <tr>
                  <th className="l pin w-10 min-w-[40px] max-[760px]:w-7 max-[760px]:min-w-[28px]">
                    <span className="sr-only">순위</span>
                  </th>
                  <th className="l pin min-[761px]:w-[240px]">팀</th>
                  <th className="narrow">합계</th>
                  <th className="max-[760px]:hidden">킬 점수</th>
                  {Array.from({ length: played }, (_, r) => (
                    <th key={r}>
                      {r + 1}R{f.weather[r] && <span className="block text-[12px] font-normal max-[760px]:hidden">{f.weather[r]}</span>}
                    </th>
                  ))}
                  <th className="max-[760px]:hidden">감점</th>
                  <th className="wide">합계</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row, i) => (
                  <tr key={row.key} className={i + 1 === qualify ? "[&>td]:border-b-2 [&>td]:border-b-line-strong" : undefined}>
                    <td className="l pin">
                      {/* 휴대폰 폭은 배지 대신 순위 아래 짧은 글자로 표시 */}
                      <span className="inline-flex flex-col items-center gap-0.5">
                        <span className={champ?.key === row.key ? "rk first" : i < qualify ? "rk adv" : "rk"}>{i + 1}</span>
                        {(champ?.key === row.key || i < qualify) && (
                          <span className="text-[9px] leading-none text-fg-3 min-[761px]:hidden">{champ?.key === row.key ? "우승" : "진출"}</span>
                        )}
                      </span>
                    </td>
                    <td className="l pin max-w-[260px]">
                      <span className="min-[761px]:hidden">
                        <TeamName team={TEAM.get(row.key)!} size={18} short />
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 max-[760px]:hidden">
                        <TeamName team={TEAM.get(row.key)!} />
                        {champ?.key === row.key && <span className="cp">체크포인트 우승</span>}
                        {i < qualify && <span className="cp">결승 진출</span>}
                      </span>
                    </td>
                    <td className="narrow font-bold">
                      {fmt(row.total)}
                      {row.penalty > 0 && <span className="block text-[11px] font-normal text-minus">감점 {fmt(row.penalty)}</span>}
                    </td>
                    <td className="text-fg-2 max-[760px]:hidden">{fmt(row.killScore)}</td>
                    {Array.from({ length: played }, (_, r) => (
                      <td key={r} className={rounds[r]?.[row.key]?.placement === 1 ? "font-bold" : "text-fg-2"}>
                        <span className="relative inline-flex items-center justify-end gap-1">
                          {held(row.key, r) && <Ring color="var(--text-3)" />}
                          {rounds[r]?.[row.key] ? fmt(gameScore(rounds[r][row.key])) : ""}
                        </span>
                      </td>
                    ))}
                    <td className="max-[760px]:hidden">{row.penalty ? <span className="text-minus">-{fmt(row.penalty)}</span> : ""}</td>
                    <td className="wide font-bold">{fmt(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </KelScroll>
        </section>
        <section className="panel p-5 max-[760px]:p-4" aria-labelledby="flow">
          <h2 id="flow" className="text-[17px] font-extrabold">
            {EVENT_NAME[f.event]} {f.stage} 누적 점수
          </h2>
          <span className="legend mt-2">
            {focus.map((k, i) => (
              <span key={k}>
                <i style={{ background: TONES[i], height: 3 }} />
                {i === 0 && champ ? "우승" : `${i + 1}위`} {name(k)}
              </span>
            ))}
            {!semi && (
              <span>
                <i style={{ width: 9, height: 9, border: "2px solid var(--text-3)", borderRadius: 999 }} />
                체크포인트에 도달한 라운드
              </span>
            )}
          </span>
          <div className="mt-3">
            <FlowChart key={f.key} cum={cum} order={order} focus={focus} holders={state.holders} />
          </div>
        </section>
      </div>
    </KelPage>
  );
}
