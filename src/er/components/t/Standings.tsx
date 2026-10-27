import { barTotal, type GroupResult } from "@/er/lib/engine";
import { fmt, num } from "@/er/lib/format";
import type { Mode, Rules } from "@/er/lib/rules";
import Bar, { Legend } from "./Bar";

const TIE: Record<string, string> = {
  killScore: "킬 점수로 가름",
  kills: "킬 수로 가름",
  rankScore: "순위 점수로 가름",
  wins: "1위 횟수로 가름",
  lastPlacement: "마지막 라운드 순위로 가름",
};

export function Delta({ d }: { d: number }) {
  if (d > 0) return <span className="text-[12px] font-bold whitespace-nowrap text-up" role="img" aria-label={`${d}계단 상승`}>▲{d}</span>;
  if (d < 0) return <span className="text-[12px] font-bold whitespace-nowrap text-minus" role="img" aria-label={`${-d}계단 하락`}>▼{-d}</span>;
  return null;
}

export default function Standings({ result, rules, mode, label }: { result: GroupResult; rules: Rules; mode: Mode; label: string }) {
  const { standings, played } = result;
  const max = Math.max(1, ...standings.map(barTotal));
  const advance = rules.advance;
  const killLabel = rules.tiebreak === "kills" ? "킬" : "킬 점수";
  const anyPenalty = standings.some((s) => s.penalty > 0);
  const ties = Object.entries(
    standings.reduce<Record<string, string[]>>((acc, s) => {
      if (s.tiedBy) (acc[s.tiedBy] ??= []).push(s.name);
      return acc;
    }, {}),
  );
  if (standings.length === 0) {
    return (
      <section className="panel overflow-x-auto p-7 text-center" aria-label={`${label} 순위표`}>
        <p className="text-fg-3">아직 등록된 경기 결과가 없습니다.</p>
      </section>
    );
  }
  return (
    <section className="panel overflow-x-auto" aria-label={`${label} 순위표`} tabIndex={0}>
      {played > 0 && (
        <div className="border-b border-line-soft px-2 py-2.5 min-[761px]:hidden">
          <Legend rounds={played} advance={advance} />
        </div>
      )}
      <table className="stand">
        <thead>
          <tr>
            <th scope="col" className="c-rank">순위</th>
            <th scope="col">팀</th>
            <th scope="col" className="c-bar">
              <Legend rounds={played} advance={advance} />
            </th>
            <th scope="col" className="r c-extra">1위 횟수</th>
            <th scope="col" className="r c-extra">순위 점수</th>
            <th scope="col" className="r c-ks">{killLabel}</th>
            {anyPenalty && <th scope="col" className="r c-pen">감점</th>}
            <th scope="col" className="r">총점</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const cls = s.rank === 1 ? "first" : advance > 0 && s.rank <= advance ? "adv" : "";
            return (
              <tr key={s.key} className={advance > 0 && s.rank === advance && i < standings.length - 1 ? "cut" : undefined}>
                <td className="c-rank">
                  <span className={`rk ${cls}`}>{s.rank}</span> <Delta d={s.delta} />
                </td>
                <td className="c-name">
                  <div className="nm">
                    <span className="min-w-0 truncate">{s.name}</span>
                    {s.fixed && <span className="cp">{s.fixed}위 확정</span>}
                    {mode !== "points" && s.checkpoint && <span className="cp">체크포인트</span>}
                  </div>
                  <div className="mini-bar">
                    <Bar s={s} max={max} rounds={played} height={10} labels={false} />
                  </div>
                </td>
                <td className="c-bar">
                  <Bar s={s} max={max} rounds={played} />
                </td>
                <td className="r c-extra tabular-nums">{s.wins}</td>
                <td className="r c-extra tabular-nums">{num(s.rankScore)}</td>
                <td className="r c-ks tabular-nums">{rules.tiebreak === "kills" ? fmt(s.kills) : num(s.killScore)}</td>
                {anyPenalty && <td className="r c-pen tabular-nums">{s.penalty > 0 ? `-${fmt(s.penalty)}` : ""}</td>}
                <td className="r tot tabular-nums">
                  {num(s.total)}
                  {s.tiedBy && (
                    <span className="tie-mark" title={`동점, ${TIE[s.tiedBy]}`} role="img" aria-label={`동점, ${TIE[s.tiedBy]}`}>
                      =
                    </span>
                  )}
                  <small className="ks-mobile text-fg-3">
                    {killLabel} {rules.tiebreak === "kills" ? fmt(s.kills) : num(s.killScore)}
                    {s.penalty > 0 && <span className="text-minus">, 감점 {fmt(s.penalty)}</span>}
                  </small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {ties.length > 0 && (
        <p className="stand-foot">
          {ties.map(([by, names]) => (
            <span key={by}>
              <span className="tie-mark">=</span> 동점인 {names.join(", ")}: {TIE[by]}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
