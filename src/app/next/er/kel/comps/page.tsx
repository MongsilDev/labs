import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import Char from "@/er/components/t/Char";
import { Logo } from "@/er/components/kel/Team";
import { characterName } from "@/er/lib/format";
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
  if (!data) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  if (!all.length) return <Shell here="kel"><p className="text-ink-3" role="status">아직 {MIN}번 이상 등장한 3인 조합이 없습니다.</p></Shell>;
  const sort = COLS.find((c) => c.k === s) ?? COLS[0];
  const rows = [...all].sort((a, b) => (sort.low ? a[sort.k] - b[sort.k] : b[sort.k] - a[sort.k]) || b.count - a.count);
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">많이 등장한 3인 조합</h1>
        <p className="text-[13px] text-ink-3 num">{MIN}번 이상 등장한 조합 {rows.length}개</p>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="comps" />
        <div className="scroll-fade -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <table className="tbl">
            <thead>
              <tr>
                <th className="l">조합</th>
                {COLS.map((c) => (
                  <th key={c.k} className="sm:w-[88px]" aria-sort={c === sort ? (c.low ? "ascending" : "descending") : undefined}>
                    <Link href={`/next/er/kel/comps${c === COLS[0] ? "" : `?s=${c.k}`}`} aria-current={c === sort ? "true" : undefined} className="hover:no-underline">
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
                    {/* 좁은 폭에서는 이름을 빼고 한 줄에 둠 */}
                    <span className="flex gap-1.5 sm:hidden">
                      {r.characters.map((c) => <Char key={c} name={c} label="" size={28} />)}
                      <span className="sr-only">{r.characters.map(characterName).join(", ")}</span>
                    </span>
                    <span className="hidden flex-wrap gap-x-4 font-semibold sm:flex">
                      {r.characters.map((c) => <Char key={c} name={c} size={24} />)}
                    </span>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.k} className={c === sort ? "font-bold" : ""}>{c.fmt(r)}</td>
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
