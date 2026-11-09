import Shell from "@/next/Shell";
import Rail from "@/next/Rail";
import { breakEven, getRp, MIN_N, type RpHour } from "@/next/rp";

export const dynamic = "force-dynamic";
export const metadata = { title: "RP 손익" };

const n = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const range = ([a, z]: [number, number]) => (z >= 99 ? `${a}+` : `${a}~${z}`);
const bandName = (lo: number, hi: number) => (hi >= 99999 ? `${n(lo)} 이상` : `${n(lo)}~${n(hi - 1)}`);
// 양수는 초록, 음수는 빨강. 60 RP에서 가장 진함
const tint = (v: number) => `color-mix(in srgb, var(${v >= 0 ? "--up" : "--down"}) ${Math.round(Math.min(Math.abs(v) / 60, 1) * 55)}%, transparent)`;

// viewBox 폭을 실제 그려지는 폭에 맞춰 글자가 표 머리와 같은 12px로 보이게 함
function Hours({ hours, w: W = 1100, h: H = 200, every = 3 }: { hours: RpHour[]; w?: number; h?: number; every?: number }) {
  const L = 34, B = 22, T = 8;
  const ext = Math.max(...hours.map((d) => Math.abs(d.gain) + d.ci));
  const step = ext > 8 ? 5 : 2;
  const lim = Math.ceil(ext / step) * step;
  const ticks: number[] = [];
  for (let v = -lim; v <= lim; v += step) ticks.push(v);
  const x = (h: number) => L + (h + 0.5) * ((W - L) / 24);
  const y = (v: number) => T + ((lim - v) / (2 * lim)) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="시간대별 평균 RP 변화와 95% 범위">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--rule-2)" : "var(--rule)"} />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)" className="num">{signed(v)}</text>
        </g>
      ))}
      {hours.map((d) => (
        <g key={d.h}>
          <title>{`${d.h}시, 평균 ${signed(d.gain)}, 95% 범위 ±${d.ci}`}</title>
          <line x1={x(d.h)} x2={x(d.h)} y1={y(d.gain + d.ci)} y2={y(d.gain - d.ci)} stroke="var(--ink-3)" strokeWidth="2" />
          <circle cx={x(d.h)} cy={y(d.gain)} r="3.5" fill="var(--ink)" />
          {d.h % every === 0 && <text x={x(d.h)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--ink-3)" className="num">{d.h}시</text>}
        </g>
      ))}
    </svg>
  );
}

export default async function NextRp({ searchParams }: { searchParams: Promise<{ rp?: string }> }) {
  const q = await searchParams;
  const data = await getRp();
  if (!data) return <Shell here="rp"><h1 className="text-[26px] font-black">RP 손익</h1><p className="mt-3 text-ink-3" role="status">지금은 RP 손익 표를 가져올 수 없습니다.</p></Shell>;
  const rp = Number(q.rp);
  const band = data.bands.find((b) => rp >= b.lo && rp < b.hi) ?? data.bands.find((b) => b.lo === 8400) ?? data.bands[0];
  const even = breakEven(band);
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  return (
    <Shell here="rp">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">RP 손익</h1>
        <p className="text-[13px] text-ink-3 num">
          아시아1 상위 1,000명 경기 {n(data.games)}판, {day.format(data.from)}~{day.format(data.to)}
        </p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <Rail groups={[{ name: "게임 전 RP", items: data.bands.map((b) => ({ href: `/next/er/rp?rp=${b.lo}`, label: bandName(b.lo, b.hi), on: b === band })) }]} />
        <div className="grid min-w-0 content-start gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="sec min-w-0">
            <h2 className="sec-h">
              순위와 팀 처치에 따른 평균 RP
              <small className="num">입장료 {band.entry}, 평균 팀 처치 {band.tkAvg.toFixed(1)}</small>
            </h2>
            <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l w-12 sm:w-16" rowSpan={2}>순위</th>
                    <th colSpan={data.tk.length} className="!h-7 !text-center">팀 처치</th>
                  </tr>
                  <tr>
                    {data.tk.map((t) => <th key={t[0]} className="!text-center">{range(t)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {band.cells.map((row, i) => (
                    <tr key={i}>
                      <td className="l font-semibold">{i + 1}위</td>
                      {row.map((c, j) => (
                        <td key={j} className="!text-center font-bold" style={c.n >= MIN_N && c.m != null ? { background: tint(c.m) } : undefined}>
                          {c.n >= MIN_N && c.m != null ? (
                            <span title={`${n(c.n)}판, 95% 범위 ±${c.ci}`}>{signed(c.m)}</span>
                          ) : (
                            <span className="font-normal text-ink-3">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="sec">
            <h2 className="sec-h">본전이 되는 팀 처치</h2>
            <table className="tbl">
              <tbody>
                {even.map((j, i) => (
                  <tr key={i}>
                    <td className="l font-semibold">{i + 1}위</td>
                    <td className={j == null ? "text-ink-3" : "font-bold"}>{j == null ? "없음" : `${data.tk[j][0]}개부터`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="sec min-w-0 xl:col-span-2">
            <h2 className="sec-h">
              시간대별 평균 RP
              <small className="num">{bandName(band.lo, band.hi)} RP</small>
            </h2>
            <div className="hidden sm:block"><Hours hours={band.hours} /></div>
            <div className="sm:hidden"><Hours hours={band.hours} w={360} h={200} every={6} /></div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
