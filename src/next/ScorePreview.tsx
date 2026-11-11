import { computeGroup } from "@/er/lib/engine";
import { exampleView } from "@/er/lib/example";

// 1위 칸이 가장 진하고 아래로 갈수록 옅어짐. /next/er/score 순위표와 같은 색
const heat = (p: number | null) => (p == null ? undefined : `color-mix(in srgb, var(--hot) ${Math.max(0, 60 - (p - 1) * 8)}%, transparent)`);

/** 로그인하지 않은 사람에게 보이는 예시 대회 순위표 윗부분 */
export default function ScorePreview({ rows = 4, big = false }: { rows?: number; big?: boolean }) {
  const ex = exampleView();
  const g = ex.groups[0];
  const res = computeGroup({ mode: ex.mode, rules: ex.rules, plannedRounds: ex.plannedRounds, rounds: g.rounds, penalties: g.penalties, weather: g.weather, aliases: g.aliases, overrides: g.overrides });
  const rounds = Array.from({ length: res.played }, (_, i) => i + 1);
  return (
    <figure className="m-0 mt-5">
      <figcaption className="text-[12px] font-semibold text-ink-3">{ex.name}</figcaption>
      <table className={`tbl mt-1 table-fixed ${big ? "text-[15px] [&_td]:h-10!" : "text-[13px]"}`}>
        <thead>
          <tr>
            <th className="w-5">#</th>
            <th className="l">팀</th>
            {rounds.map((r) => (
              <th key={r} className={`${big ? "w-[22px] sm:w-10" : "w-[22px]"} px-0! text-center!`}>{r}R</th>
            ))}
            <th className={big ? "w-[58px] sm:w-[72px]" : "w-[52px]"}>총점</th>
          </tr>
        </thead>
        <tbody>
          {res.standings.slice(0, rows).map((s) => (
            <tr key={s.key}>
              <td className="text-ink-3">{s.rank}</td>
              <td className="l truncate font-semibold">{s.name}</td>
              {s.rounds.map((r, i) => (
                <td key={i} className="px-0! text-center!" style={{ background: heat(r?.placement ?? null) }}>
                  {r?.placement ?? "-"}
                </td>
              ))}
              <td className="font-black">{s.total.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
