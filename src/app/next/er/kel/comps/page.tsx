import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import Char from "@/er/components/t/Char";
import { Logo } from "@/er/components/kel/Team";
import { TEAM } from "@/er/lib/kel";
import { kelData } from "@/er/server/kel";
import { comps } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "많이 등장한 3인 조합" };

const MIN = 8;
type Row = ReturnType<typeof comps>[number];
const COLS: { k: "count" | "avgPlace" | "wins"; label: string; fmt: (r: Row) => string; low?: boolean }[] = [
  { k: "count", label: "등장", fmt: (r) => `${r.count}` },
  { k: "avgPlace", label: "평균 순위", fmt: (r) => r.avgPlace.toFixed(2), low: true },
  { k: "wins", label: "1위", fmt: (r) => `${r.wins}` },
];

export default async function NextKelComps({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const data = kelData();
  const all = data ? comps(data, MIN) : [];
  if (!all.length) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const sort = COLS.find((c) => c.k === s) ?? COLS[0];
  const rows = [...all].sort((a, b) => (sort.low ? a[sort.k] - b[sort.k] : b[sort.k] - a[sort.k]) || b.count - a.count);
  const xs = all.map((r) => r[sort.k]);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const heat = (x: number) => {
    const t = hi === lo ? 0 : (x - lo) / (hi - lo);
    return `color-mix(in srgb, var(--hot) ${Math.round((sort.low ? 1 - t : t) * 55)}%, transparent)`;
  };
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">많이 등장한 3인 조합</h1>
        <p className="text-[13px] text-ink-3 num">{MIN}번 이상 등장한 조합 {rows.length}개</p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="comps" />
        <div className="scroll-fade -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <table className="tbl">
            <thead>
              <tr>
                <th className="l">조합</th>
                {COLS.map((c) => (
                  <th key={c.k} className="sm:w-[88px]">
                    <Link href={`/next/er/kel/comps${c === COLS[0] ? "" : `?s=${c.k}`}`} aria-current={c === sort ? "true" : undefined} className="text-ink-3 hover:no-underline aria-[current=true]:text-ink aria-[current=true]:underline aria-[current=true]:decoration-hot aria-[current=true]:decoration-2 aria-[current=true]:underline-offset-4">
                      {c.label}
                    </Link>
                  </th>
                ))}
                <th className="l hidden md:table-cell">많이 고른 팀</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.characters.join("|")}>
                  <td className="l">
                    <span className="grid gap-1 font-semibold sm:flex sm:flex-wrap sm:gap-x-4">
                      {r.characters.map((c) => <Char key={c} name={c} size={24} />)}
                    </span>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.k} className={c === sort ? "font-bold" : ""} style={c === sort ? { background: heat(r[c.k]) } : undefined}>{c.fmt(r)}</td>
                  ))}
                  <td className="l hidden md:table-cell">
                    <span className="flex gap-3 text-ink-2">
                      {r.teams.slice(0, 3).map(([k, n]) => (
                        <span key={k} className="inline-flex items-center gap-1.5" title={TEAM.get(k)?.name}>
                          <Logo team={TEAM.get(k)!} size={20} className="ring-1 ring-rule-2" />
                          {n}
                        </span>
                      ))}
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
