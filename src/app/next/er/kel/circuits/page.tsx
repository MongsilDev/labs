import { Fragment } from "react";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import { Logo } from "@/er/components/kel/Team";
import { KEL_EVENTS, QUALIFY, SEEDS, seasonStandings } from "@/er/lib/kel";

export const dynamic = "force-dynamic";
export const metadata = { title: "서킷별 순위" };

const CIRCUITS = KEL_EVENTS.filter((e) => /^c\d$/.test(e.key));
const CUTS: Record<number, string> = { [SEEDS]: "결승 직행", [QUALIFY]: "준결승 진출" };
const heat = (place: number) => `color-mix(in srgb, var(--hot) ${Math.max(0, 70 - (place - 1) * 6)}%, transparent)`;

// 서킷이 끝날 때마다의 누적 순위. 위쪽이 1위
function Path({ ranks, n }: { ranks: number[]; n: number }) {
  const W = 104, H = 30;
  const x = (i: number) => 4 + (i * (W - 8)) / Math.max(1, ranks.length - 1);
  const y = (r: number) => 4 + ((r - 1) * (H - 8)) / Math.max(1, n - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="ml-auto block" role="img" aria-label={`누적 순위 ${ranks.join(", ")}위`}>
      <line x1={4} x2={W - 4} y1={y(1)} y2={y(1)} stroke="var(--rule)" />
      <polyline points={ranks.map((r, i) => `${x(i)},${y(r)}`).join(" ")} fill="none" stroke="var(--ink-2)" strokeWidth="1.5" />
      <circle cx={x(ranks.length - 1)} cy={y(ranks.at(-1)!)} r="3" fill="var(--hot)" />
    </svg>
  );
}

export default async function NextKelCircuits() {
  const season = seasonStandings();
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">서킷별 순위</h1>
        <p className="text-[13px] text-ink-3 num">서킷 {CIRCUITS.length}개, {season.length}팀</p>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="circuits" />
        <div className="min-w-0">
          <table className="tbl lg:!w-auto">
            <thead>
              <tr>
                <th className="l w-8">#</th>
                <th className="l lg:w-[240px]">팀</th>
                {CIRCUITS.map((c, i) => (
                  <th key={c.key} className="!text-center lg:w-[76px]" title={`${c.name}, ${c.dates}`}><span className="hidden sm:inline">서킷 </span>{i + 1}</th>
                ))}
                <th className="hidden md:table-cell lg:w-[128px]">누적 순위</th>
                <th className="lg:w-[96px]"><span className="text-ink underline decoration-hot decoration-2 underline-offset-4">포인트</span></th>
              </tr>
            </thead>
            <tbody>
              {season.map((r) => (
                <Fragment key={r.team.key}>
                  <tr>
                    <td className="l font-bold">{r.rank}</td>
                    <td className="l">
                      <span className="flex items-center gap-2 font-semibold">
                        <Logo team={r.team} size={24} className="ring-1 ring-rule-2" />
                        <span className="sm:hidden">{r.team.short}</span>
                        <span className="hidden truncate sm:inline">{r.team.name}</span>
                      </span>
                    </td>
                    {r.team.circuits.map((p, i) => (
                      <td key={i} className="!text-center font-bold" style={{ background: heat(p) }} title={`${r.points[i]?.toLocaleString("ko-KR") ?? "-"} 포인트`}>{p}</td>
                    ))}
                    <td className="hidden md:table-cell"><Path ranks={r.ranks} n={season.length} /></td>
                    <td className="font-bold">{r.total.toLocaleString("ko-KR")}</td>
                  </tr>
                  {CUTS[r.rank] && (
                    <tr aria-hidden="true">
                      <td colSpan={CIRCUITS.length + 4} className="!h-6 border-t-2 !border-t-ink-3 !py-0 text-[12px] font-semibold text-ink-3">위 {r.rank}팀 {CUTS[r.rank]}</td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
