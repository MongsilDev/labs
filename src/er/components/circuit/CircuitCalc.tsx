"use client";

import { useState } from "react";
import Lines from "@/components/Lines";
import HeatCell from "@/er/components/kel/HeatCell";
import { CIRCUIT_LIMITS, type CircuitOdds, type CircuitTeam, circuitOdds, parseTable, parseTeams, problem, runsFor } from "@/er/lib/circuit";

type Result = { teams: CircuitTeam[]; odds: CircuitOdds; runs: number };

const percent = (v: number) => (v >= 0.995 ? ">99" : v < 0.005 ? "<1" : String(Math.round(v * 100)));
const int = (v: number) => v.toLocaleString("ko-KR");

export default function CircuitCalc() {
  const [teamsText, setTeamsText] = useState("");
  const [tableText, setTableText] = useState("");
  const [left, setLeft] = useState(1);
  const [spots, setSpots] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const { teams, bad } = parseTeams(teamsText);
    const setup = { teams, table: parseTable(tableText), left, spots };
    const err = problem(setup, bad);
    setError(err);
    if (err) return;
    setBusy(true);
    // 계산 중 표시가 먼저 그려지도록 다음 틱에 계산
    setTimeout(() => {
      const runs = runsFor(teams.length, left);
      setResult({ teams, odds: circuitOdds(setup, runs), runs });
      setBusy(false);
    }, 0);
  }

  const rows = result
    ? result.teams
        .map((team, t) => ({ team, t }))
        .sort((a, b) => b.team.points - a.team.points || result.odds.p[b.t] - result.odds.p[a.t])
    : [];
  const rank = (points: number) => 1 + rows.filter((r) => r.team.points > points).length;

  return (
    <div className="grid grid-cols-[minmax(0,400px)_minmax(0,1fr)] items-start gap-10 max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:gap-6">
      <form className="panel grid gap-[18px] p-[22px]" onSubmit={submit} noValidate>
        <div>
          <label className="lbl" htmlFor="ci-teams">
            팀과 현재 포인트
          </label>
          <textarea
            id="ci-teams"
            className="field min-h-[220px] resize-y py-2.5 leading-[1.6]"
            value={teamsText}
            onChange={(e) => setTeamsText(e.target.value)}
            placeholder={"팀 이름 120\n팀 이름 95\n팀 이름 80"}
            spellCheck={false}
          />
        </div>
        <div>
          <label className="lbl" htmlFor="ci-table">
            대회 순위별 포인트
          </label>
          <input id="ci-table" className="field" value={tableText} onChange={(e) => setTableText(e.target.value)} placeholder="100, 70, 50, 40" inputMode="numeric" spellCheck={false} />
          <p className="mt-1.5 text-[13px] text-fg-3">1위부터 마지막 순위까지 쉼표로 나눠 적어주세요.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="lbl" htmlFor="ci-left">
              남은 대회
            </label>
            <input
              id="ci-left"
              className="field"
              type="number"
              inputMode="numeric"
              min={0}
              max={CIRCUIT_LIMITS.left}
              value={left}
              onChange={(e) => setLeft(Math.trunc(Number(e.target.value)) || 0)}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="ci-spots">
              진출 팀 수
            </label>
            <input
              id="ci-spots"
              className="field"
              type="number"
              inputMode="numeric"
              min={1}
              max={CIRCUIT_LIMITS.teams - 1}
              value={spots}
              onChange={(e) => setSpots(Math.trunc(Number(e.target.value)) || 0)}
            />
          </div>
        </div>
        {error && (
          <p className="text-[13px] text-minus" role="alert">
            <Lines text={error} />
          </p>
        )}
        <button className="btn primary lg w-full" disabled={busy}>
          {busy ? "계산 중" : "계산"}
        </button>
      </form>

      {result && (
        <section className="panel p-5 max-[760px]:p-4" aria-labelledby="ci-result">
          <h2 id="ci-result" className="text-[15px] font-bold text-fg-2">
            진출 확률
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="kel-table w-full">
              <thead>
                <tr>
                  <th className="l w-10">
                    <span className="sr-only">순위</span>
                  </th>
                  <th className="l w-full">팀</th>
                  <th>포인트</th>
                  <th className="min-w-[64px]">진출</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ team, t }) => {
                  const { p, sure, never } = result.odds;
                  return (
                    <tr key={team.name}>
                      <td className="l tabular-nums text-fg-3">{rank(team.points)}</td>
                      <td className="l max-w-[240px] truncate">{team.name}</td>
                      <td className="tabular-nums">{int(team.points)}</td>
                      {never[t] ? (
                      <td className="text-fg-3">탈락</td>
                    ) : (
                      <HeatCell v={p[t]}>{sure[t] ? "확정" : `${percent(p[t])}%`}</HeatCell>
                    )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 grid gap-1.5 border-t border-line-soft pt-3 text-[13px] text-fg-3">
            <li>
              <Lines text={`남은 대회마다 모든 팀이 각 순위를 같은 확률로 얻는다고 보고 ${int(result.runs)}번 뽑아 계산했습니다.`} />
            </li>
            <li>
              <Lines text="합계 포인트가 같은 팀은 무작위로 순위를 정했습니다. 실제 동점 처리는 대회 규정을 따릅니다." />
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
