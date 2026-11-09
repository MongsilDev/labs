import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import Char from "@/er/components/t/Char";
import { KEL_EVENTS } from "@/er/lib/kel";
import { kelData } from "@/er/server/kel";
import { characterStats, MIN_GAMES, type CharacterStat } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "실험체" };

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
// 평균 순위와 1위 비율은 표본이 적으면 비우고 정렬에서 맨 아래로 보냄
const COLS: { k: "games" | "avgPlace" | "winRate"; label: string; fmt: (r: CharacterStat) => string; low?: boolean; min?: boolean }[] = [
  { k: "games", label: "등장", fmt: (r) => `${r.games}` },
  { k: "avgPlace", label: "평균 순위", fmt: (r) => r.avgPlace.toFixed(2), low: true, min: true },
  { k: "winRate", label: "1위 비율", fmt: (r) => pct(r.winRate), min: true },
];

export default async function NextKelCharacters({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const data = kelData();
  if (!data) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const stats = characterStats(data);
  const events = KEL_EVENTS.filter((e) => stats.eventGames[e.key] > 0);
  const sort = COLS.find((c) => c.k === s) ?? COLS[0];
  const ok = (r: CharacterStat, c: (typeof COLS)[number]) => !c.min || r.games >= MIN_GAMES;
  const rows = [...stats.rows].sort((a, b) => Number(ok(b, sort)) - Number(ok(a, sort)) || (sort.low ? a[sort.k] - b[sort.k] : b[sort.k] - a[sort.k]) || b.games - a.games);
  const xs = rows.filter((r) => ok(r, sort)).map((r) => r[sort.k]);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const heat = (x: number) => {
    const t = hi === lo ? 0 : (x - lo) / (hi - lo);
    return `color-mix(in srgb, var(--hot) ${Math.round((sort.low ? 1 - t : t) * 55)}%, transparent)`;
  };
  const top = Math.max(...stats.rows.flatMap((r) => events.map((e) => r.byEvent[e.key])));
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">실험체</h1>
        <p className="text-[13px] text-ink-3 num">실험체 {rows.length}명</p>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="characters" />
        <div className="min-w-0">
          <table className="tbl lg:!w-auto">
            <thead>
              <tr>
                <th className="l lg:w-[200px]">실험체</th>
                {COLS.map((c) => (
                  <th key={c.k} className="lg:w-[96px]">
                    <Link href={`/next/er/kel/characters${c === COLS[0] ? "" : `?s=${c.k}`}`} aria-current={c === sort ? "true" : undefined} className="text-ink-3 hover:no-underline aria-[current=true]:text-ink aria-[current=true]:underline aria-[current=true]:decoration-hot aria-[current=true]:decoration-2 aria-[current=true]:underline-offset-4">
                      {c.label}
                    </Link>
                  </th>
                ))}
                <th className="l hidden md:table-cell">대회별 픽률</th>
              </tr>
              <tr className="hidden md:table-row">
                <th colSpan={COLS.length + 1} className="!h-6" />
                <th className="l !h-6">
                  <span className="flex gap-0.5">
                    {events.map((e) => <span key={e.key} className="w-9 text-center text-[11px] font-normal" title={e.name}>{e.name.replace("서킷 ", "C").replace("오프닝 위크", "OW").replace("미드 시즌 컵", "MSC").replace("챔피언십", "NC")}</span>)}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="l font-semibold"><Char name={r.key} size={24} /></td>
                  {COLS.map((c) => (
                    <td key={c.k} className={c === sort && ok(r, c) ? "font-bold" : ok(r, c) ? "" : "text-ink-3"} style={c === sort && ok(r, c) ? { background: heat(r[c.k]) } : undefined}>
                      {ok(r, c) ? c.fmt(r) : "-"}
                    </td>
                  ))}
                  <td className="l hidden md:table-cell">
                    <span className="flex gap-0.5">
                      {events.map((e) => {
                        const v = r.byEvent[e.key];
                        return <span key={e.key} className="h-5 w-9" style={{ background: `color-mix(in srgb, var(--ink-2) ${Math.round((v / top) * 80)}%, transparent)` }} title={`${e.name} ${pct(v)}`} />;
                      })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
