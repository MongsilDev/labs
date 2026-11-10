import Image from "next/image";
import Shell from "@/next/Shell";
import Filters from "@/next/Filters";
import LateMap from "@/next/LateMap";
import { getLate, type LateRow } from "@/next/late";

export const dynamic = "force-dynamic";
export const metadata = { title: "초반과 막판" };

const n = (v: number) => v.toLocaleString("ko-KR");
// 평균과의 차이가 95% 범위를 넘을 때만 칠함. good은 평균보다 나은 쪽
const tint = (d: number, ci: number, good: boolean, full: number) =>
  Math.abs(d) <= ci ? undefined : { background: `color-mix(in srgb, var(${good ? "--up" : "--down"}) ${Math.round(Math.min(Math.abs(d) / full, 1) * 50)}%, transparent)` };

const SORTS = {
  fin: { by: (a: LateRow, b: LateRow) => b.fin - a.fin },
  early: { by: (a: LateRow, b: LateRow) => a.early - b.early },
} as const;

export default async function NextLate({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const q = await searchParams;
  const data = await getLate();
  if (!data) return <Shell here="late"><h1 className="text-[26px] font-black">초반과 막판</h1><p className="mt-3 text-ink-3" role="status">지금은 초반과 막판 표를 가져올 수 없습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const s = q.s === "early" ? "early" : "fin";
  const rows = [...data.rows].sort(SORTS[s].by);
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  const min = Math.round(data.cut / 60);
  return (
    <Shell here="late">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">초반과 막판</h1>
        <p className="text-[13px] text-ink-3 num">
          아시아1 상위 1,000명 {n(data.games)}경기, {day.format(data.from)}~{day.format(data.to)}
        </p>
      </div>
      <Filters
        groups={[
          {
            name: "정렬",
            items: (Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => ({
              href: k === "fin" ? "/next/er/late" : `/next/er/late?s=${k}`,
              label: k === "fin" ? "TOP3 중 1위 비율이 높은 순" : `${min}분 안에 탈락한 비율이 낮은 순`,
              on: k === s,
            })),
          },
        ]}
      />
      <div className="mt-6 grid gap-10 xl:grid-cols-[minmax(0,1fr)_440px]">
      <section className="sec min-w-0 xl:sticky xl:top-4 xl:self-start">
        <h2 className="sec-h">실험체 지도<small className="num">{rows.length}개</small></h2>
        <div className="hidden sm:block"><LateMap rows={data.rows} early={data.early} fin={data.fin} cut={data.cut} /></div>
        <div className="sm:hidden"><LateMap rows={data.rows} early={data.early} fin={data.fin} cut={data.cut} w={360} h={360} fs={11} labels={8} /></div>
      </section>
      <section className="sec min-w-0">
        <table className="tbl">
          <thead>
            <tr>
              <th className="l">실험체</th>
              <th aria-sort={s === "early" ? "ascending" : undefined}>{min}분 안에 탈락</th>
              <th aria-sort={s === "fin" ? "descending" : undefined}>TOP3 중 1위</th>
              <th className="hidden md:table-cell">판</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-ink-3">
              <td className="l">전체 평균</td>
              <td>{data.early.toFixed(1)}%</td>
              <td>{data.fin.toFixed(1)}%</td>
              <td className="hidden md:table-cell" />
            </tr>
            {rows.map((r) => (
              <tr key={`${r.char}-${r.weapon}`}>
                <td className="l">
                  <span className="flex items-center gap-2">
                    <Image className="portrait" src={`/img/er/char/${r.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
                    <span className="flex flex-wrap gap-x-1.5">
                      <span className="text-ink-3">{r.weaponName}</span>
                      <span className="font-semibold">{r.name}</span>
                    </span>
                  </span>
                </td>
                <td className="font-bold" style={tint(r.early - data.early, r.earlyCi, r.early < data.early, 6)} title={`95% 범위 ±${r.earlyCi}`}>{r.early.toFixed(1)}%</td>
                <td className="font-bold" style={tint(r.fin - data.fin, r.finCi, r.fin > data.fin, 10)} title={`TOP3 ${n(r.top3)}판, 95% 범위 ±${r.finCi}`}>{r.fin.toFixed(1)}%</td>
                <td className="hidden text-ink-3 md:table-cell">{n(r.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      </div>
    </Shell>
  );
}
