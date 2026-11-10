"use client";

import { useState } from "react";
import { type CutData, DAY, int, md, TIERS } from "@/er/lib/cut";
import { ticks } from "@/er/lib/ticks";
import { useWidth } from "@/er/lib/useWidth";

type Point = { t: number; kind: "past" | "now" | "future"; v: Record<string, { a?: number | null; b?: number | null; mid?: number; lo?: number; hi?: number }> };

const PAST_DAYS = 21;

export default function CutChart({ data }: { data: CutData }) {
  const [box, w] = useWidth<HTMLDivElement>(960);
  const [hover, setHover] = useState<number | null>(null);

  const now = data.updatedAt * 1000;
  const narrow = w < 560;
  const h = narrow ? 300 : 360;
  const pad = { l: narrow ? 46 : 54, r: narrow ? 14 : 20, t: 18, b: 30 };

  // 날짜 축: 지난 오전 9시 기록, 지금, 앞으로 오전 9시 예상
  const days = new Map<number, Point>();
  const at = (t: number, kind: Point["kind"]) => {
    if (!days.has(t)) days.set(t, { t, kind, v: {} });
    return days.get(t)!;
  };
  for (const { key } of TIERS) {
    const tier = data.tiers[key];
    for (const [t, b, a] of tier.history.slice(-PAST_DAYS)) at(t * 1000, "past").v[key] = { a, b };
    at(now, "now").v[key] = { a: tier.cut, b: tier.board };
    for (const [t, mid, lo, hi] of tier.forecast ?? []) at(t * 1000, "future").v[key] = { mid, lo, hi };
  }
  const points = [...days.values()].sort((x, y) => x.t - y.t);
  const t0 = points[0].t;
  const t1 = points[points.length - 1].t;

  const values = points.flatMap((p) => Object.values(p.v).flatMap((v) => [v.a, v.b, v.lo, v.hi].filter((x): x is number => x != null)));
  const span = Math.max(...values) - Math.min(...values);
  const ys = ticks(Math.min(...values) - span * 0.05, Math.max(...values) + span * 0.05, narrow ? 4 : 5);
  const [vlo, vhi] = [ys[0], ys[ys.length - 1]];
  const x = (t: number) => pad.l + ((t - t0) / Math.max(t1 - t0, 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - vlo) / (vhi - vlo)) * (h - pad.t - pad.b);
  const path = (pts: [number, number][]) => pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");

  // 종료 이름표와 겹칠 만큼 가까우면 「오늘」을 점선 위쪽 끝으로 올림. 폭은 12px 글꼴 어림값
  const todayTop = x(now) + 14 > x(t1) - ((md(t1).length + 1) * 7 + 24) - 4;

  const weekly: number[] = [];
  for (let t = t0 + DAY; t < t1; t += 7 * DAY) weekly.push(t);

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i;
    });
    setHover(best);
  }

  const hp = hover != null ? points[hover] : null;
  const tipLeft = hp ? Math.min(Math.max(x(hp.t) - 130, 0), w - 260) : 0;

  return (
    <div ref={box} className="relative select-none">
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="block h-auto w-full touch-pan-y"
        role="img"
        aria-label="이터니티와 데미갓 컷의 지난 기록과 시즌 종료까지 예상"
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={() => setHover(null)}
      >
        {ys.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
            <text x={pad.l - 8} y={y(v)} dy="0.35em" textAnchor="end" fontSize="12" fill="var(--text-3)">
              {int(v)}
            </text>
          </g>
        ))}
        {[now, t1].map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={pad.t} y2={h - pad.b} stroke="var(--line-strong)" strokeDasharray="3 4" />
        ))}
        {weekly
          .filter((t) => Math.abs(x(t) - x(now)) > 44 && x(t1) - x(t) > 70)
          .map((t) => (
            <text key={t} x={x(t)} y={h - 8} textAnchor="middle" fontSize="12" fill="var(--text-3)">
              {md(t)}
            </text>
          ))}
        <text x={x(now)} y={todayTop ? pad.t - 6 : h - 8} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">
          오늘
        </text>
        <text x={x(t1)} y={h - 8} textAnchor="end" fontSize="12" fontWeight="700" fill="var(--text)">
          {md(t1)} 종료
        </text>

        {TIERS.map(({ key, color }) => {
          const tier = data.tiers[key];
          if (tier.cut == null) return null;
          const past = points.filter((p) => p.kind !== "future");
          const board = past.flatMap((p) => (p.v[key]?.b != null ? [[p.t, p.v[key].b!] as [number, number]] : []));
          const real = past.flatMap((p) => (p.v[key]?.a != null ? [[p.t, p.v[key].a!] as [number, number]] : []));
          const fut = (tier.forecast ?? []).map(([t, mid, lo, hi]) => ({ t: t * 1000, mid, lo, hi }));
          const band = fut.length
            ? `M${x(now)},${y(tier.cut)}` + fut.map((f) => `L${x(f.t).toFixed(1)},${y(f.hi).toFixed(1)}`).join("") +
              [...fut].reverse().map((f) => `L${x(f.t).toFixed(1)},${y(f.lo).toFixed(1)}`).join("") + "Z"
            : "";
          return (
            <g key={key}>
              {band && <path d={band} fill={color} opacity="0.16" />}
              <path d={path(board)} fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1.5" />
              <path d={path(real)} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
              {fut.length > 0 && (
                <path d={path([[now, tier.cut], ...fut.map((f) => [f.t, f.mid] as [number, number])])} fill="none" stroke={color} strokeWidth="2" strokeDasharray="5 5" />
              )}
              <circle cx={x(now)} cy={y(tier.cut)} r="5.5" fill="var(--surface)" stroke={color} strokeWidth="3" />
              {fut.length > 0 && <circle cx={x(t1)} cy={y(fut[fut.length - 1].mid)} r="4" fill={color} />}
            </g>
          );
        })}
        {hp && <line x1={x(hp.t)} x2={x(hp.t)} y1={pad.t} y2={h - pad.b} stroke="var(--text-3)" />}
      </svg>
      {hp && (
        <div className="pointer-events-none absolute top-2 w-[260px] rounded-md border border-line bg-surface px-3 py-2 text-[13px] shadow-lg" style={{ left: tipLeft }}>
          <div className="mb-1 font-bold">
            {hp.kind === "now" ? "지금" : `${md(hp.t)} 오전 9시${hp.kind === "future" ? " 예상" : ""}`}
          </div>
          {TIERS.map(({ key, name, color }) => {
            const v = hp.v[key];
            if (!v) return null;
            return (
              <div key={key} className="flex items-baseline gap-2">
                <span className="size-2 shrink-0 self-center rounded-full" style={{ background: color }} />
                <span className="whitespace-nowrap text-fg-2">{name}</span>
                <span className="ml-auto font-bold whitespace-nowrap tabular-nums">
                  {v.mid != null ? `${int(v.mid)}` : v.a != null ? int(v.a) : v.b != null ? int(v.b) : "-"}
                </span>
                <span className="w-[92px] shrink-0 text-right text-[12px] whitespace-nowrap text-fg-3 tabular-nums">
                  {v.mid != null ? `${int(v.lo!)}~${int(v.hi!)}` : v.a != null && v.b != null ? `순위표 ${int(v.b)}` : "순위표"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
