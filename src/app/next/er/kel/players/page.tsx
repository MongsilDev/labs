import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import { PlayerName } from "@/er/components/kel/Team";
import { TEAM } from "@/er/lib/kel";
import { kelData } from "@/er/server/kel";
import { playerStats, type PlayerStat } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "선수 카드" };

const COLS: { k: keyof PlayerStat; label: string; fmt: (v: number) => string; low?: boolean }[] = [
  { k: "kpr", label: "게임당 처치", fmt: (v) => v.toFixed(2) },
  { k: "avgPlace", label: "평균 순위", fmt: (v) => v.toFixed(2), low: true },
  { k: "top3", label: "TOP3", fmt: (v) => `${Math.round(v * 100)}%` },
  { k: "damage", label: "피해량", fmt: (v) => Math.round(v).toLocaleString("ko-KR") },
  { k: "damageShare", label: "팀 피해 비중", fmt: (v) => `${Math.round(v * 100)}%` },
  { k: "ccShare", label: "팀 CC 비중", fmt: (v) => `${Math.round(v * 100)}%` },
  { k: "healShare", label: "팀 회복 비중", fmt: (v) => `${Math.round(v * 100)}%` },
];

export default async function NextKelPlayers({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams;
  const data = kelData();
  if (!data) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.</p></Shell>;
  const sort = COLS.find((c) => c.k === s) ?? COLS[0];
  const all = playerStats(data).filter((p) => p.games >= 20);
  const v = (p: PlayerStat, k: keyof PlayerStat) => p[k] as number;
  const range = new Map(COLS.map((c) => {
    const xs = all.map((p) => v(p, c.k));
    return [c.k, [Math.min(...xs), Math.max(...xs)]] as const;
  }));
  // 열마다 가장 좋은 값이 가장 진한 칸
  const heat = (c: (typeof COLS)[number], x: number) => {
    const [lo, hi] = range.get(c.k)!;
    const t = hi === lo ? 0 : (x - lo) / (hi - lo);
    return `color-mix(in srgb, var(--hot) ${Math.round((c.low ? 1 - t : t) * 30)}%, transparent)`;
  };
  const rows = [...all].sort((a, b) => (sort.low ? v(a, sort.k) - v(b, sort.k) : v(b, sort.k) - v(a, sort.k)));
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">선수 카드</h1>
        <p className="text-[13px] text-ink-3 num">20게임 이상 출전한 {rows.length}명</p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="players" />
        <div className="scroll-fade -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <table className="tbl min-w-[760px]">
            <thead>
              <tr>
                <th className="l sticky left-0 bg-bg">선수</th>
                <th>게임</th>
                {COLS.map((c) => (
                  <th key={c.k}>
                    <Link href={`/next/er/kel/players?s=${c.k}`} aria-current={c === sort ? "true" : undefined} className="text-ink-3 hover:no-underline aria-[current=true]:text-ink aria-[current=true]:underline aria-[current=true]:decoration-hot aria-[current=true]:decoration-2 aria-[current=true]:underline-offset-4">
                      {c.label}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.name}>
                  <td className="l sticky left-0 bg-bg">
                    <PlayerName name={p.name} team={TEAM.get(p.team)} />
                  </td>
                  <td className="text-ink-3">{p.games}</td>
                  {COLS.map((c) => (
                    <td key={c.k} className={c === sort ? "font-bold" : ""} style={{ background: heat(c, v(p, c.k)) }}>
                      {c.fmt(v(p, c.k))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
