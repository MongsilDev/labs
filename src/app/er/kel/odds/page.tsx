import HeatCell from "@/er/components/kel/HeatCell";
import KelPage, { KelScroll, KelTabs, NO_DATA } from "@/er/components/kel/KelPage";
import { Logo, TeamName } from "@/er/components/kel/Team";
import { byText } from "@/er/lib/format";
import { EVENT_NAME, KEL_SCREENS, KEL_TEAMS, QUALIFY, SEEDS, type KelEvent } from "@/er/lib/kel";
import { CIRCUIT_STAGES, kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { guaranteed, kelOdds, status, type TeamOdds } from "@/er/server/kel-odds";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("odds");

const CIRCUITS = [1, 2, 3, 4];
const DONE = [1, 2, 3, 4, 5, 6];
// 주소에 단계가 없으면 서킷 4 최종전 뒤
const DEFAULT = { c: 4, s: 5 };
const circuitName = (c: number) => EVENT_NAME[`c${c}` as KelEvent];
const day = (date: string) => date.slice(5).split("-").map(Number).join(".");
// 10만 번 시뮬레이션이라 소수점 아래는 오차 범위
const percent = (v: number) => (v >= 0.995 ? ">99" : v < 0.005 ? "<1" : Math.round(v * 100));

function Cell({ o, b }: { o: TeamOdds; b: number }) {
  if (o.sure[b]) return <b className="text-accent-text">확정</b>;
  if (o.never[b]) return <span className="text-fg-3">-</span>;
  return <>{percent(o.p[b])}%</>;
}

function Heat({ o, on, wide }: { o: TeamOdds; on: boolean; wide: boolean }) {
  const v = o.p[0];
  return (
    <HeatCell v={o.never[0] ? null : v} className={[on && "on", wide && "wide"].filter(Boolean).join(" ")}>
      {o.sure[0] ? "확정" : percent(v)}
    </HeatCell>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ c?: string; s?: string }> }) {
  const { user, owner } = await kelGate("odds");
  const q = await searchParams;
  const data = kelData();
  const odds = data && (await kelOdds(data));
  if (!odds) return <KelPage user={user} owner={owner} screen="odds" missing={data ? ["진출 확률을 계산하지 못했습니다.", "서킷 1~4의 단계별 경기 기록이 모자라거나 서킷 최종 순위와 맞지 않습니다. 서킷마다 A조부터 결승까지의 경기 기록 CSV를 서버 데이터 폴더의 kel 폴더에 넣어주세요."] : NO_DATA} />;
  const { input, views } = odds;
  const circuit = CIRCUITS.includes(Number(q.c)) ? Number(q.c) : DEFAULT.c;
  const done = DONE.includes(Number(q.s)) ? Number(q.s) : DEFAULT.s;
  const view = views.find((v) => v.circuit === circuit && v.done === done)!;
  const path = KEL_SCREENS.odds.path;
  const href = (c: number, s: number) => (c === DEFAULT.c && s === DEFAULT.s ? path : `${path}?c=${c}&s=${s}`);
  // 포인트가 같으면 같은 순위, 줄은 결승 직행 확률이 높은 팀부터
  const rows = KEL_TEAMS.map((team, t) => ({ team, t, points: guaranteed(input, view, t), p: view.teams[t].p })).sort(
    (a, b) => b.points - a.points || b.p[0] - a.p[0] || a.p[2] - b.p[2] || byText(a.team.name, b.team.name),
  );
  const rank = (points: number) => 1 + rows.filter((r) => r.points > points).length;
  const stage = CIRCUIT_STAGES[done - 1];
  const shown = CIRCUITS.filter((c) => c <= circuit);
  const cases = circuit === 4 && done === 5 ? rows.filter((r) => odds.cases.has(r.t)) : [];

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="odds"
      lead={[`서킷 포인트 합계 1~${SEEDS}위 팀은 결승에 직행하고, ${SEEDS + 1}~${QUALIFY}위 팀은 준결승에 출전합니다.`]}
      notes={[
        "확률은 남은 경기에서 각 팀이 오를 수 있는 순위를 모두 같은 확률로 얻는다고 보고 계산했습니다.",
        "표의 -는 남은 경기 결과와 관계없이 일어날 수 없는 경우입니다.",
        "포인트는 그 단계까지 확보한 서킷 포인트이고, 진행 중인 서킷의 포인트는 팀이 진출한 단계에서 받을 수 있는 가장 낮은 포인트로 계산했습니다.",
      ]}
    >
      <div className="grid gap-2">
        <KelTabs label="서킷" items={CIRCUITS.map((c) => [String(c), circuitName(c)] as const)} current={String(circuit)} href={(k) => href(Number(k), done)} />
        <KelTabs
          label="단계"
          items={DONE.map((s) => {
            const date = views.find((v) => v.circuit === circuit && v.done === s)!.date;
            return [String(s), <>{`${CIRCUIT_STAGES[s - 1]} 뒤`}{date && <small className="ml-1.5 text-[12px] font-normal opacity-75">{day(date)}</small>}</>] as const;
          })}
          current={String(done)}
          href={(k) => href(circuit, Number(k))}
        />
      </div>
      <section className="panel p-5 max-[760px]:p-4">
        <KelScroll label={`${circuitName(circuit)} ${stage} 뒤 진출 확률`}>
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l pin w-10 min-w-[40px]">
                  <span className="sr-only">순위</span>
                </th>
                <th className="l pin">팀</th>
                {shown.map((c) => (
                  <th key={c} className="wide">
                    {circuitName(c)}
                  </th>
                ))}
                <th className="wide">포인트</th>
                <th>결승 직행</th>
                <th>
                  <span className="wide">준결승 진출</span>
                  <span className="narrow">준결승</span>
                </th>
                <th>진출 실패</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team.key}>
                  <td className="l pin">
                    <span className="rk">{rank(r.points)}</span>
                  </td>
                  <td className="l pin max-w-[200px]">
                    <TeamName team={r.team} />
                    <span className="narrow mt-0.5 text-[12px] text-fg-3">
                      {r.points.toLocaleString("ko-KR")}포인트
                      <br />
                      {circuitName(circuit)} {status(input, view, r.t)}
                    </span>
                  </td>
                  {shown.map((c) => (
                    <td key={c} className="wide text-fg-2">
                      {c < circuit ? `${input.ranks[r.t][c - 1]}위` : status(input, view, r.t)}
                    </td>
                  ))}
                  <td className="wide font-bold">{r.points.toLocaleString("ko-KR")}</td>
                  {[0, 1, 2].map((b) => (
                    <td key={b}>
                      <Cell o={view.teams[r.t]} b={b} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
      {cases.length > 0 && (
        <section className="panel p-5 max-[760px]:p-4" aria-labelledby="cases">
          <h2 id="cases" className="text-[17px] font-extrabold">
            경우의 수
          </h2>
          <ul className="mt-2 grid grid-cols-2 gap-x-8 max-[760px]:grid-cols-1">
            {cases.map((r) => (
              <li key={r.team.key} className="border-t border-line-soft py-3">
                <TeamName team={r.team} />
                <p className="mt-1.5 text-[14px] text-fg-2">
                  {odds.cases.get(r.t)!.map((line) => (
                    <span key={line} className="block">
                      {line.replaceAll(" 수 ", "\u00a0수 ")}
                    </span>
                  ))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="trend">
        <h2 id="trend" className="flex flex-wrap items-baseline gap-x-3 text-[17px] font-extrabold">
          단계별 결승 직행 확률
          <span className="text-[14px] font-semibold text-fg-3">단위 %</span>
        </h2>
        <KelScroll label="단계별 결승 직행 확률" className="mt-3">
          <table className="kel-table kel-heat">
            <thead>
              <tr>
                <th rowSpan={2} className="l pin">
                  팀
                </th>
                {CIRCUITS.map((c) => (
                  <th key={c} colSpan={6} className={c === circuit ? "text-center" : "wide text-center"}>
                    {circuitName(c)}
                  </th>
                ))}
              </tr>
              <tr>
                {CIRCUITS.flatMap((c) =>
                  CIRCUIT_STAGES.map((s, i) => (
                    <th key={`${c}-${s}`} aria-label={`${s} 뒤`} className={["px-0.5 text-center text-[12px]", c !== circuit && "wide", c === circuit && i + 1 === done && "on"].filter(Boolean).join(" ")}>
                      {s}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t }) => (
                <tr key={t}>
                  <td className="l pin">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Logo team={KEL_TEAMS[t]} />
                      <span className="truncate max-[760px]:sr-only">{KEL_TEAMS[t].name}</span>
                      <span className="hidden max-[760px]:inline" aria-hidden>
                        {KEL_TEAMS[t].short}
                      </span>
                    </span>
                  </td>
                  {views.map((v) => (
                    <Heat key={`${v.circuit}-${v.done}`} o={v.teams[t]} on={v === view} wide={v.circuit !== circuit} />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
    </KelPage>
  );
}
