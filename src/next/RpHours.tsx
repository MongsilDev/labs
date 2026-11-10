"use client";

import { useState } from "react";
import type { RpHour } from "./rp";

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
const n = (v: number) => v.toLocaleString("ko-KR");

// 글자가 표 머리와 같은 12px로 보이도록 viewBox 폭을 실제 그려지는 폭에 맞춘다
export default function RpHours({ hours, w: W = 1100, h: H = 200, every = 3 }: { hours: RpHour[]; w?: number; h?: number; every?: number }) {
  const [on, setOn] = useState<number | null>(null);
  if (!hours.length) return null;
  const L = 34, B = 22, T = 8;
  const ext = Math.max(...hours.map((d) => Math.abs(d.gain) + d.ci));
  const step = ext > 8 ? 5 : 2;
  const lim = Math.max(step, Math.ceil(ext / step) * step);
  const ticks: number[] = [];
  for (let v = -lim; v <= lim; v += step) ticks.push(v);
  const bw = (W - L) / 24;
  const x = (h: number) => L + (h + 0.5) * bw;
  const y = (v: number) => T + ((lim - v) / (2 * lim)) * (H - T - B);
  const hi = hours.reduce((a, d) => (d.gain > a.gain ? d : a));
  const lo = hours.reduce((a, d) => (d.gain < a.gain ? d : a));
  const cur = on == null ? null : hours.find((d) => d.h === on) ?? null;
  const text = cur ? `${cur.h}시 평균 ${signed(cur.gain)} RP, 95% 범위 ±${cur.ci}, ${n(cur.n)}판` : "";

  // 점이 아니라 열 전체를 대상으로 포인터가 가리키는 시간을 고른다
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    if (vx < L) return;
    setOn(Math.min(23, Math.max(0, Math.floor((vx - L) / bw))));
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setOn((v) => ((v ?? 0) + (e.key === "ArrowRight" ? 1 : 23)) % 24);
    } else if (e.key === "Escape") setOn(null);
  };
  const side = (d: RpHour) => (d.h > 20 ? { x: x(d.h) - 9, a: "end" as const } : { x: x(d.h) + 9, a: "start" as const });

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full touch-pan-y"
        role="img"
        aria-label="시간대별 평균 RP 변화와 95% 범위"
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOn(null)}
        onFocus={() => setOn((v) => v ?? hi.h)}
        onBlur={() => setOn(null)}
        onKeyDown={key}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--rule-2)" : "var(--rule)"} />
            <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--ink-3)" className="num">{signed(v)}</text>
          </g>
        ))}
        {cur && <rect x={x(cur.h) - bw / 2} y={T} width={bw} height={H - T - B} fill="var(--row)" />}
        {hours.map((d) => (
          <g key={d.h}>
            <line x1={x(d.h)} x2={x(d.h)} y1={y(d.gain + d.ci)} y2={y(d.gain - d.ci)} stroke={d === cur ? "var(--ink-2)" : "var(--ink-3)"} strokeWidth="2" strokeLinecap="round" />
            <circle cx={x(d.h)} cy={y(d.gain)} r="4" fill="var(--ink)" stroke="var(--bg)" strokeWidth="2" />
            {d.h % every === 0 && <text x={x(d.h)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--ink-3)" className="num">{d.h}시</text>}
          </g>
        ))}
        {/* 열 폭이 좁으면 라벨이 옆 시간의 막대와 겹친다 */}
        {!cur && bw >= 30 && (hi === lo ? [hi] : [hi, lo]).map((d) => (
          <text key={d.h} x={side(d).x} y={y(d.gain) + 4} textAnchor={side(d).a} fontSize="12" fontWeight="600" fill="var(--ink-2)" className="num">{signed(d.gain)}</text>
        ))}
      </svg>
      {cur && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 border border-rule-2 bg-bg px-2.5 py-1.5 text-[12px] whitespace-nowrap text-ink-3 num"
          style={cur.h > 20 ? { right: `${100 - (x(cur.h) / W) * 100}%` } : { left: `${(x(cur.h) / W) * 100}%`, transform: cur.h < 3 ? undefined : "translateX(-50%)" }}
        >
          <b className="mr-1.5 text-[15px] text-ink">{signed(cur.gain)}</b>
          {cur.h}시, ±{cur.ci}, {n(cur.n)}판
        </div>
      )}
      <p className="sr-only" aria-live="polite">{text}</p>
    </div>
  );
}
