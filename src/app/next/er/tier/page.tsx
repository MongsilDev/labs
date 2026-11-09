import Image from "next/image";
import Link from "next/link";
import Shell from "@/next/Shell";
import Rail from "@/next/Rail";
import { pickView, signed, type TierCombo } from "@/er/lib/tier";
import { getTier } from "@/er/server/tier";

export const dynamic = "force-dynamic";
export const metadata = { title: "실험체 티어" };

const ROLES = ["전사", "스킬 딜러", "원거리 딜러", "탱커", "지원가", "암살자"];
const SORTS = [
  ["score", "점수"],
  ["pick", "픽률"],
  ["top3", "TOP3"],
] as const;
type Sort = (typeof SORTS)[number][0];
const GRADES = ["S", "A", "B", "C", "D"] as const;
const n = (v: number) => v.toLocaleString("ko-KR");

function Range({ c, lo, hi }: { c: TierCombo; lo: number; hi: number }) {
  const W = 88;
  const x = (v: number) => ((v - lo) / (hi - lo)) * W;
  const h = c.half ?? 0;
  return (
    <svg width={W} height="12" className="inline-block align-middle" aria-hidden="true">
      <line x1={x(0)} x2={x(0)} y1="0" y2="12" stroke="var(--rule-2)" />
      <line x1={x(c.score - h)} x2={x(c.score + h)} y1="6" y2="6" stroke={`var(--g-${c.grade.toLowerCase()})`} strokeOpacity="0.55" strokeWidth="4" />
      <circle cx={x(c.score)} cy="6" r="3" fill={`var(--g-${c.grade.toLowerCase()})`} />
    </svg>
  );
}

export default async function NextTier({ searchParams }: { searchParams: Promise<{ v?: string; role?: string; sort?: string }> }) {
  const q = await searchParams;
  const data = await getTier();
  const view = data ? pickView(data, q.v) : null;
  if (!data || !view) return <Shell here="tier"><h1 className="text-[26px] font-black">실험체 티어</h1><p className="mt-3 text-ink-3" role="status">지금은 티어 정보를 가져올 수 없습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const role = ROLES.includes(q.role ?? "") ? q.role : undefined;
  const sort: Sort = SORTS.some(([k]) => k === q.sort) ? (q.sort as Sort) : "score";
  const url = (p: { v?: string; role?: string; sort?: string }) => {
    const s = new URLSearchParams();
    const v = "v" in p ? p.v : q.v, r = "role" in p ? p.role : role, o = "sort" in p ? p.sort : sort;
    if (v) s.set("v", v);
    if (r) s.set("role", r);
    if (o && o !== "score") s.set("sort", o);
    const t = s.toString();
    return `/next/er/tier${t ? `?${t}` : ""}`;
  };
  const list = view.combos.filter((c) => !role || c.roles?.includes(role));
  const key = (c: TierCombo) => (sort === "pick" ? c.pick : sort === "top3" ? c.top3 : c.score);
  const lo = Math.min(...view.combos.map((c) => c.score - (c.half ?? 0)));
  const hi = Math.max(...view.combos.map((c) => c.score + (c.half ?? 0)));
  const at = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(data.updatedAt);
  let rank = 0;
  return (
    <Shell here="tier">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">실험체 티어</h1>
        <p className="text-[13px] text-ink-3 num">
          {data.band.server} 상위 1,000명 경기 {n(view.rows)}판, {at} 갱신
        </p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <Rail
          groups={[
            { name: "기간", items: data.views.map((x) => ({ href: url({ v: x.id }), label: x.label, on: x.id === view.id })) },
            { name: "역할군", items: [{ href: url({ role: undefined }), label: "전체", on: !role }, ...ROLES.map((r) => ({ href: url({ role: r }), label: r, on: r === role }))] },
            { name: "정렬", items: SORTS.map(([k, l]) => ({ href: url({ sort: k }), label: l, on: k === sort })) },
          ]}
        />
        <table className="tbl self-start">
          <thead>
            <tr>
              <th className="l w-10 !pl-3.5">#</th>
              <th className="l">실험체</th>
              <th>점수</th>
              <th className="hidden md:table-cell">90% 범위</th>
              <th>TOP3</th>
              <th className="hidden md:table-cell">평균 순위</th>
              <th className="hidden md:table-cell">승률</th>
              <th>픽률</th>
              <th className="hidden sm:table-cell">판</th>
            </tr>
          </thead>
          {GRADES.map((g) => {
            const rows = list.filter((c) => c.grade === g).sort((a, b) => key(b) - key(a));
            if (!rows.length) return null;
            return (
              <tbody key={g}>
                <tr className="pointer-events-none">
                  <td colSpan={9} className="l !h-auto !border-b-0 pt-4 pb-1">
                    <span className="flex items-center gap-2">
                      <span className={`grade grade-${g}`}>{g}</span>
                      <span className="text-[12px] text-ink-3 num">{rows.length}개</span>
                    </span>
                  </td>
                </tr>
                {rows.map((c) => (
                  <tr key={`${c.char}-${c.weapon}`} style={{ boxShadow: `inset 3px 0 0 var(--g-${g.toLowerCase()})` }}>
                    <td className="l !pl-3.5 text-ink-3">{++rank}</td>
                    <td className="l">
                      <Link href={`/next/er/tier/${c.char}-${c.weapon}`} className="flex items-center gap-2">
                        <Image className="portrait" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-ink-3">{c.weaponName}</span>
                      </Link>
                    </td>
                    <td className="font-bold">{signed(c.score)}</td>
                    <td className="hidden md:table-cell"><Range c={c} lo={lo} hi={hi} /></td>
                    <td>{c.top3.toFixed(1)}%</td>
                    <td className="hidden md:table-cell">{c.place.toFixed(2)}</td>
                    <td className="hidden md:table-cell">{c.win.toFixed(1)}%</td>
                    <td>{c.pick.toFixed(2)}%</td>
                    <td className="hidden text-ink-3 sm:table-cell">{n(c.n)}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </Shell>
  );
}
