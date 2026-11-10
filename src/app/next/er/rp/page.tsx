import Shell from "@/next/Shell";
import Filters from "@/next/Filters";
import { breakEven, getRp, MIN_N } from "@/next/rp";
import RpHours from "@/next/RpHours";

export const dynamic = "force-dynamic";
export const metadata = { title: "RP 손익" };

const n = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const range = ([a, z]: [number, number]) => (z >= 99 ? `${a}+` : `${a}~${z}`);
const bandName = (lo: number, hi: number) => (hi >= 99999 ? `${n(lo)} 이상` : `${n(lo)}~${n(hi - 1)}`);
// 양수는 초록, 음수는 빨강. 60 RP에서 가장 진하고, 50%를 넘으면 어두운 테마 초록 칸의 글자 대비가 4.5 아래로 떨어짐
const tint = (v: number) => `color-mix(in srgb, var(${v >= 0 ? "--up" : "--down"}) ${Math.round(Math.min(Math.abs(v) / 60, 1) * 50)}%, transparent)`;

export default async function NextRp({ searchParams }: { searchParams: Promise<{ rp?: string }> }) {
  const q = await searchParams;
  const data = await getRp();
  if (!data) return <Shell here="rp"><h1 className="text-[26px] font-black">RP 손익</h1><p className="mt-3 text-ink-3" role="status">지금은 RP 손익 표를 가져올 수 없습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const rp = Number(q.rp);
  const band = data.bands.find((b) => rp >= b.lo && rp < b.hi) ?? data.bands.find((b) => b.lo === 8400) ?? data.bands[0];
  const even = breakEven(band);
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  return (
    <Shell here="rp">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">RP 손익</h1>
        <p className="text-[13px] text-ink-3 num">
          아시아1 상위 1,000명 {n(data.games)}경기, {day.format(data.from)}~{day.format(data.to)}
        </p>
      </div>
      <Filters groups={[{ name: "게임 전 RP", items: data.bands.map((b) => ({ href: `/next/er/rp?rp=${b.lo}`, label: bandName(b.lo, b.hi), on: b === band })) }]} />
      <div className="mt-6">
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
                    <th className="l w-12 !align-bottom sm:w-16" rowSpan={2}>순위</th>
                    <th colSpan={data.tk.length} className="!h-7 !text-center">팀 처치</th>
                  </tr>
                  <tr>
                    {data.tk.map((t) => <th key={t[0]} className="!h-8 !py-0 !text-center">{range(t)}</th>)}
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
              {/* 옆 표의 두 줄 헤더와 같은 높이 */}
              <thead>
                <tr>
                  <th className="l !align-bottom xl:h-[62px]">순위</th>
                  <th className="!align-bottom">팀 처치</th>
                </tr>
              </thead>
              <tbody>
                {even.map((j, i) => (
                  <tr key={i}>
                    <td className="l font-semibold">{i + 1}위</td>
                    <td className={j == null ? "text-ink-3" : "font-bold"}>{j == null ? "없음" : `${data.tk[j][0]} 이상`}</td>
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
            <div className="hidden sm:block"><RpHours hours={band.hours} /></div>
            <div className="sm:hidden"><RpHours hours={band.hours} w={360} h={200} every={6} /></div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
