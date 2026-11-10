import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import { Logo } from "@/er/components/kel/Team";
import { EVENT_NAME, TEAM } from "@/er/lib/kel";
import { fmt } from "@/er/lib/format";
import { gameScore, standings } from "@/er/lib/kel-calc";
import { kelData } from "@/er/server/kel";
import { scoreStages } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "라운드별 점수" };

// 라운드 순위가 1위면 가장 진하고 8위 아래로는 칠하지 않음
const heat = (place: number) => `color-mix(in srgb, var(--hot) ${Math.max(0, 60 - (place - 1) * 8)}%, transparent)`;

// 모든 팀의 누적 점수 선. 1위와 2위만 진하게 그림
function Flow({ cum, focus, W = 1000, H = 300 }: { cum: Record<string, number[]>; focus: string[]; W?: number; H?: number }) {
  const L = 40, R = W < 500 ? 96 : 120, T = 10, B = 26;
  const n = Object.values(cum)[0].length;
  const max = Math.max(...Object.values(cum).flat());
  const step = max > 200 ? 50 : 20;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, n - 1);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const keys = [...Object.keys(cum).filter((k) => !focus.includes(k)), ...[...focus].reverse()];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="라운드별 누적 점수">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--rule)" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)" className="num">{v}</text>
        </g>
      ))}
      {Array.from({ length: n }, (_, i) => (
        <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--ink-3)" className="num">{i === 0 ? "시작" : `${i}R`}</text>
      ))}
      {keys.map((k) => {
        const f = focus.indexOf(k);
        const color = f === 0 ? "var(--ink)" : f === 1 ? "var(--ink-3)" : "var(--rule-2)";
        const last = cum[k].at(-1)!;
        return (
          <g key={k}>
            <title>{`${TEAM.get(k)?.name} ${fmt(last)}점`}</title>
            <polyline points={cum[k].map((v, i) => `${x(i)},${y(v)}`).join(" ")} fill="none" stroke={color} strokeWidth={f < 0 ? 1.5 : 2.5} />
            {f >= 0 && (
              <text x={W - R + 8} y={y(last) + 4 + (f === 1 && Math.abs(y(last) - y(cum[focus[0]].at(-1)!)) < 14 ? 14 : 0)} fontSize="12" fontWeight="700" fill={color}>{TEAM.get(k)?.name}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default async function NextKelFinals({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const q = await searchParams;
  const data = kelData();
  const list = data ? scoreStages(data) : [];
  const f = list.find((x) => x.key === q.f) ?? list.at(-1);
  if (!f) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const { state, rounds, teams, qualify } = f;
  const played = state.played;
  const steps = Array.from({ length: played + 1 }, (_, i) => standings(teams, rounds.slice(0, i)));
  const cum = Object.fromEntries(teams.map((k) => [k, steps.map((s) => s.find((r) => r.key === k)!.total)]));
  const champ = state.champion?.key;
  const focus = state.rows.slice(0, 2).map((r) => r.key);
  const held = (k: string, r: number) => state.holders[r]?.includes(k);
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">라운드별 점수</h1>
        <p className="text-[13px] text-ink-3 num">{EVENT_NAME[f.event]} {f.stage}, {played}라운드{champ ? `, 우승 ${TEAM.get(champ)?.name}` : ""}</p>
      </div>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="finals" />
        <div className="grid min-w-0 content-start gap-8">
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0" aria-label="경기">
            {list.map((x) => (
              <Link key={x.key} href={x === list.at(-1) ? "/next/er/kel/finals" : `/next/er/kel/finals?f=${x.key}`} aria-current={x === f ? "page" : undefined} className="opt shrink-0">
                {EVENT_NAME[x.event]} {x.stage}
              </Link>
            ))}
          </nav>
          <div className="scroll-fade -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l hidden w-8 sm:table-cell">#</th>
                  <th className="l sticky left-0 bg-bg">팀</th>
                  {Array.from({ length: played }, (_, r) => (
                    <th key={r} className="!text-center max-sm:!px-1 lg:w-[60px]" title={f.weather[r] || undefined}>{r + 1}R</th>
                  ))}
                  <th className="hidden md:table-cell lg:w-[76px]">킬 점수</th>
                  <th className="hidden md:table-cell lg:w-[64px]">감점</th>
                  <th className="pin-r lg:w-[76px]" aria-sort="descending">합계</th>
                </tr>
              </thead>
              <tbody>
                {state.rows.map((row, i) => {
                  const t = TEAM.get(row.key)!;
                  return (
                    <tr key={row.key} className={i + 1 === qualify ? "[&>td]:!border-b-2 [&>td]:!border-b-ink-3" : undefined}>
                      <td className="l hidden font-bold sm:table-cell">{i + 1}</td>
                      <td className="l sticky left-0 bg-bg">
                        <span className="flex items-center gap-2 font-semibold">
                          <Logo team={t} size={22} className="ring-1 ring-rule-2" />
                          <span className="sm:hidden">{t.short}</span>
                          <span className="hidden truncate sm:inline">{t.name}</span>
                          {champ === row.key && <span className="text-[12px] font-bold text-ink-2">우승</span>}
                        </span>
                      </td>
                      {Array.from({ length: played }, (_, r) => {
                        const e = rounds[r]?.[row.key];
                        return (
                          <td key={r} className="!text-center max-sm:!px-1" style={e ? { background: heat(e.placement) } : undefined} title={e ? `${e.placement}위, 킬 점수 ${e.killScore}` : undefined}>
                            {e ? fmt(gameScore(e)) : ""}
                            {held(row.key, r) && <span className="ml-0.5 align-super text-[10px]" aria-label="체크포인트">●</span>}
                          </td>
                        );
                      })}
                      <td className="hidden text-ink-2 md:table-cell">{fmt(row.killScore)}</td>
                      <td className="hidden md:table-cell">{row.penalty ? <span className="text-down">-{fmt(row.penalty)}</span> : ""}</td>
                      <td className="pin-r font-bold">{fmt(row.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {f.stage === "결승" && (
              <p className="sticky left-4 mt-2 w-fit text-[12px] text-ink-3 lg:left-0">
                ● 체크포인트에 도달한 라운드
              </p>
            )}
          </div>
          <section className="sec min-w-0">
            <h2 className="sec-h">누적 점수</h2>
            <div className="hidden sm:block"><Flow cum={cum} focus={focus} /></div>
            <div className="sm:hidden"><Flow cum={cum} focus={focus} W={360} H={240} /></div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
