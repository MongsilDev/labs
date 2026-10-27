import Link from "next/link";
import Bar from "@/er/components/t/Bar";
import { barTotal, computeGroup } from "@/er/lib/engine";
import { exampleView } from "@/er/lib/example";
import { num } from "@/er/lib/format";

function exampleResult() {
  const ex = exampleView();
  const g = ex.groups[0];
  const res = computeGroup({
    mode: ex.mode,
    rules: ex.rules,
    plannedRounds: ex.plannedRounds,
    rounds: g.rounds,
    penalties: g.penalties,
    weather: g.weather,
    aliases: g.aliases,
    overrides: g.overrides,
  });
  return { name: ex.name, res };
}

/** bare는 허브 카드용. 대회 이름과 라운드 줄 없이 순위만 */
export default function ExampleBoard({ rows = 4, bare }: { rows?: number; bare?: boolean }) {
  const { name, res } = exampleResult();
  const top = res.standings.slice(0, rows);
  const max = Math.max(1, ...res.standings.map(barTotal));
  return (
    <section className={bare ? "" : "panel px-5 py-[18px]"} aria-labelledby={bare ? undefined : "ex-h"} aria-label={bare ? name : undefined}>
      {!bare && (
        <div className="mb-1.5 flex items-center gap-2">
          <b id="ex-h" className="min-w-0 truncate text-[15px]">
            {name}
          </b>
          <span className="ml-auto text-[13px] text-fg-3">{res.played}라운드 종료</span>
        </div>
      )}
      {top.map((s, i) => (
        <div key={s.key} className={`grid grid-cols-[34px_minmax(0,1fr)_60px] items-center gap-2.5 border-t border-line-soft py-[9px] ${bare ? "first:border-t-0 first:pt-0" : ""}`}>
          <span className={`rk ${i === 0 ? "first" : ""}`}>{s.rank}</span>
          <div>
            <div className="mb-[5px] min-w-0 truncate text-[14px] font-bold">{s.name}</div>
            <Bar s={s} max={max} rounds={res.played} height={10} labels={false} />
          </div>
          <span className="text-right text-[18px] font-extrabold tabular-nums">{num(s.total)}</span>
        </div>
      ))}
      {!bare && (
        <div className="mt-3 flex justify-end">
          <Link className="btn sm" href="/er/example/a">
            예시 대회 열기
          </Link>
        </div>
      )}
    </section>
  );
}
