import FlowChart from "@/er/components/kel/FlowChart";
import KelPage, { KelScroll, KelTabs, NO_DATA } from "@/er/components/kel/KelPage";
import { TeamName } from "@/er/components/kel/Team";
import { fmt } from "@/er/lib/format";
import { EVENT_NAME, KEL_SCREENS, TEAM, TONES, type KelEvent } from "@/er/lib/kel";
import { gameScore, standings } from "@/er/lib/kel-calc";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { finals } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("finals");

const NOTES: Partial<Record<KelEvent, string>> = {
  c2: "전남 이스포츠의 4라운드 점수는 bori.wiki 결과 표보다 2점 낮지만, 이유를 찾지 못해 경기 기록에 있는 값을 그대로 썼습니다.",
};

const Ring = ({ color }: { color: string }) => <span className="inline-block size-[9px] flex-none rounded-full border-2" style={{ borderColor: color }} aria-hidden="true" />;

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { user, owner } = await kelGate("finals");
  const q = await searchParams;
  const data = kelData();
  const list = data ? finals(data) : [];
  const f = list.find((x) => x.event === q.f) ?? list.at(-1);
  if (!f) return <KelPage user={user} owner={owner} screen="finals" missing={NO_DATA} />;

  const { state, rounds, teams } = f;
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
        state.rows.some((r) => r.penalty > 0) && "감점 열은 bori.wiki 결과 표의 점수가 경기 기록으로 계산한 점수보다 낮은 만큼입니다.",
        f.weather.some(Boolean) && "라운드 번호 아래 글자는 그 라운드의 메인 날씨입니다.",
        NOTES[f.event],
      ]}
    >
      <KelTabs
        label="결승"
        items={list.map((x) => [x.event, EVENT_NAME[x.event]] as const)}
        current={f.event}
        href={(k) => (k === list.at(-1)!.event ? KEL_SCREENS.finals.path : `${KEL_SCREENS.finals.path}?f=${k}`)}
      />
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="round-scores">
        <h2 id="round-scores" className="text-[17px] font-extrabold">
          라운드별 점수
        </h2>
        <p className="mt-1 text-[13px] text-fg-3">
          굵은 숫자는 그 라운드에서 1위를 차지한 팀의 점수입니다.
          <br />
          숫자 앞 고리는 그 팀이 체크포인트를 가진 라운드를 표시합니다.
        </p>
        <KelScroll label="라운드별 점수" className="mt-3">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l pin w-10 min-w-[40px]">
                  <span className="sr-only">순위</span>
                </th>
                <th className="l pin min-[761px]:w-[240px]">팀</th>
                <th className="narrow">합계</th>
                <th>킬 점수</th>
                {Array.from({ length: played }, (_, r) => (
                  <th key={r}>
                    {r + 1}R{f.weather[r] && <span className="block text-[12px] font-normal">{f.weather[r]}</span>}
                  </th>
                ))}
                <th>감점</th>
                <th className="wide">합계</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((row, i) => (
                <tr key={row.key}>
                  <td className="l pin">
                    <span className={champ?.key === row.key ? "rk first" : "rk"}>{i + 1}</span>
                  </td>
                  <td className="l pin max-w-[260px] max-[760px]:max-w-[132px]">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <TeamName team={TEAM.get(row.key)!} />
                      {champ?.key === row.key && <span className="cp">체크포인트 우승</span>}
                    </span>
                  </td>
                  <td className="narrow font-bold">{fmt(row.total)}</td>
                  <td className="text-fg-2">{fmt(row.killScore)}</td>
                  {Array.from({ length: played }, (_, r) => (
                    <td key={r} className={rounds[r]?.[row.key]?.placement === 1 ? "font-bold" : "text-fg-2"}>
                      <span className="inline-flex items-center justify-end gap-1">
                        {held(row.key, r) && <Ring color="var(--text-3)" />}
                        {rounds[r]?.[row.key] ? fmt(gameScore(rounds[r][row.key])) : ""}
                      </span>
                    </td>
                  ))}
                  <td>{row.penalty ? <span className="text-minus">-{fmt(row.penalty)}</span> : ""}</td>
                  <td className="wide font-bold">{fmt(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="flow">
        <h2 id="flow" className="text-[17px] font-extrabold">
          {EVENT_NAME[f.event]} 결승 누적 점수
        </h2>
        <span className="legend mt-2">
          {focus.map((k, i) => (
            <span key={k}>
              <i style={{ background: TONES[i], height: 3 }} />
              {i === 0 && champ ? "우승" : `${i + 1}위`} {name(k)}
            </span>
          ))}
          <span>
            <i style={{ width: 9, height: 9, border: "2px solid var(--text-3)", borderRadius: 999 }} />
            체크포인트를 가진 라운드
          </span>
        </span>
        <div className="mt-3">
          <FlowChart key={f.event} cum={cum} order={order} focus={focus} holders={state.holders} />
        </div>
      </section>
    </KelPage>
  );
}
