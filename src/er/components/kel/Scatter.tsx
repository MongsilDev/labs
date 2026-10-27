"use client";

import { useState } from "react";
import { fmt, pct } from "@/er/lib/format";
import { josa, TEAM, TONES } from "@/er/lib/kel";
import { ticks } from "@/er/lib/ticks";
import { useWidth } from "@/er/lib/useWidth";
import { logoUrl, plate } from "./Team";
import { tipSide } from "./tip";

type Point = { key: string; x: number; y: number; name: string; team?: string; tone?: number; info: string[] };

type Box = { x: number; y: number; w: number; h: number };

const label = (v: number, format: "pct" | "num") => (format === "pct" ? pct(v, 0) : fmt(v));
const area = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const textWidth = (s: string, size: number) => [...s].reduce((n, c) => n + (c.charCodeAt(0) > 0x2e80 ? size : size * 0.62), 0);

// 이름표 후보 자리: 점에서 글자 기준점까지 거리와 정렬 방향
const SPOTS = [
  [8, 0, "start"],
  [-8, 0, "end"],
  [0, -15, "middle"],
  [0, 15, "middle"],
  [6, -13, "start"],
  [-6, -13, "end"],
  [6, 13, "start"],
  [-6, 13, "end"],
] as const;
const SHIFT = { start: 0, middle: 0.5, end: 1 } as const;

function domain(values: number[], extra?: number): [number, number] {
  const all = extra === undefined ? values : [...values, extra];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const m = (hi - lo || 1) * 0.07;
  return [lo - m, hi + m];
}

// 로고 점은 서로 겹치면 가려지므로 겹친 만큼만 밀어냄, 다른 점은 제자리
function spread(points: Point[], x: (v: number) => number, y: (v: number) => number, gap: number, pad: { l: number; r: number; t: number; b: number }, w: number, h: number) {
  const at = new Map(points.map((p) => [p.key, [x(p.x), y(p.y)] as [number, number]]));
  const logos = points.filter((p) => p.team).map((p) => at.get(p.key)!);
  for (let n = 0; n < 50; n++) {
    let moved = false;
    for (let i = 0; i < logos.length; i++)
      for (let j = i + 1; j < logos.length; j++) {
        const [a, b] = [logos[i], logos[j]];
        const ox = gap - Math.abs(b[0] - a[0]);
        const oy = gap - Math.abs(b[1] - a[1]);
        if (ox <= 0 || oy <= 0) continue;
        moved = true;
        const k = ox < oy ? 0 : 1;
        const d = (k ? oy : ox) / 2;
        const s = b[k] > a[k] || (b[k] === a[k] && j > i) ? 1 : -1;
        a[k] -= s * d;
        b[k] += s * d;
      }
    for (const c of logos) {
      c[0] = Math.min(Math.max(c[0], pad.l), w - pad.r);
      c[1] = Math.min(Math.max(c[1], pad.t), h - pad.b);
    }
    if (!moved) break;
  }
  return at;
}

export default function Scatter({
  points,
  xLabel,
  yLabel,
  format,
  refX,
  refY,
  height = 360,
}: {
  points: Point[];
  xLabel: string;
  yLabel: string;
  format: "pct" | "num";
  refX?: number;
  refY?: number;
  height?: number;
}) {
  const [ref, w, measured] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<string | null>(null);
  const narrow = w < 560;
  const h = narrow ? Math.min(height, 360) : height;
  const pad = { l: 40, r: 16, t: 26, b: 40 };
  const [x0, x1] = domain(
    points.map((p) => p.x),
    refX,
  );
  const [y0, y1] = domain(
    points.map((p) => p.y),
    refY,
  );
  const xs = ticks(x0, x1, 5).filter((v) => v >= x0 && v <= x1);
  const ys = ticks(y0, y1, 5).filter((v) => v >= y0 && v <= y1);
  const x = (v: number) => pad.l + ((v - x0) / (x1 - x0)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * (h - pad.t - pad.b);
  const size = narrow ? 22 : 28;
  const shown = points.find((p) => p.key === hover);
  const at = spread(points, x, y, size + 2, pad, w, h);
  const ordered = [...points].sort((a, b) => (a.tone ?? -1) - (b.tone ?? -1));

  // 강조한 점의 이름표는 오른쪽, 왼쪽, 위, 아래, 대각선 네 곳 가운데 겹침이 가장 적은 자리에 둠
  const named = points.filter((p) => p.tone !== undefined);
  const dots = named.length ? points.map((p) => ({ box: { x: at.get(p.key)![0] - 6, y: at.get(p.key)![1] - 6, w: 12, h: 12 }, weight: p.tone === undefined ? 2 : 4 })) : [];
  const frame: Box = { x: pad.l, y: pad.t, w: w - pad.l - pad.r, h: h - pad.t - pad.b };
  const placed: Box[] = [];
  const tags = named.map((p) => {
    const [cx, cy] = at.get(p.key)!;
    const tw = textWidth(p.name, 11);
    const options = SPOTS.map(([dx, dy, anchor]) => ({ box: { x: cx + dx - tw * SHIFT[anchor], y: cy + dy - 7, w: tw, h: 14 }, tx: cx + dx, ty: cy + dy, anchor }));
    // 글자 기준점이 다른 강조 점에 더 가까우면 그 점의 이름표로 읽힘
    const near = (o: (typeof options)[number]) => named.filter((q) => q !== p && Math.hypot(at.get(q.key)![0] - o.tx, at.get(q.key)![1] - o.ty) < Math.hypot(cx - o.tx, cy - o.ty)).length * 400;
    const cost = (b: Box) => placed.reduce((n, o) => n + area(b, o) * 3, 0) + dots.reduce((n, d) => n + area(b, d.box) * d.weight, 0) + (b.w * b.h - area(b, frame)) * 4;
    const best = options.map((o) => ({ ...o, cost: cost(o.box) + near(o) })).reduce((a, o) => (o.cost < a.cost ? o : a));
    placed.push(best.box);
    return { key: p.key, name: p.name, ...best };
  });

  return (
    <div ref={ref} className="relative" style={{ visibility: measured ? undefined : "hidden" }}>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={`${josa(xLabel, "과", "와")} ${yLabel}`}
        onPointerDown={(e) => !(e.target as Element).closest("[data-point]") && setHover(null)}
      >
        {xs.map((v) => (
          <g key={`x${v}`}>
            <line x1={x(v)} x2={x(v)} y1={pad.t} y2={h - pad.b} stroke="var(--line-soft)" />
            <text x={x(v)} y={h - pad.b + 16} textAnchor="middle" fontSize={11} fill="var(--text-3)">
              {label(v, format)}
            </text>
          </g>
        ))}
        {ys.map((v) => (
          <g key={`y${v}`}>
            <line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
            <text x={pad.l - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
              {label(v, format)}
            </text>
          </g>
        ))}
        {refX !== undefined && <line x1={x(refX)} x2={x(refX)} y1={pad.t} y2={h - pad.b} stroke="var(--line-strong)" strokeDasharray="4 4" />}
        {refY !== undefined && <line x1={pad.l} x2={w - pad.r} y1={y(refY)} y2={y(refY)} stroke="var(--line-strong)" strokeDasharray="4 4" />}
        <text x={pad.l} y={12} fontSize={12} fill="var(--text-3)">
          {yLabel}
        </text>
        <text x={w - pad.r} y={h - 4} textAnchor="end" fontSize={12} fill="var(--text-3)">
          {xLabel}
        </text>
        {ordered.map((p) => {
          const [cx, cy] = at.get(p.key)!;
          const team = p.team ? TEAM.get(p.team) : undefined;
          return (
            <g key={p.key} data-point onPointerEnter={() => setHover(p.key)} onPointerLeave={(e) => e.pointerType !== "touch" && setHover(null)}>
              {team ? (
                <>
                  <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={5} fill={plate(team)} stroke="var(--surface)" strokeWidth={2} />
                  <image href={logoUrl(team)} x={cx - size / 2 + 2} y={cy - size / 2 + 2} width={size - 4} height={size - 4} preserveAspectRatio="xMidYMid meet" />
                </>
              ) : (
                <circle cx={cx} cy={cy} r={p.tone === undefined ? 4 : 5} fill={p.tone === undefined ? "var(--kel-0)" : TONES[p.tone]} stroke="var(--surface)" strokeWidth={2} />
              )}
              <rect x={cx - 12} y={cy - 12} width={24} height={24} fill="transparent" />
            </g>
          );
        })}
        {/* 이름표가 격자선과 다른 점 위에 놓여도 읽히게 바탕을 깔고 점보다 나중에 그림 */}
        {tags.map((t) => (
          <rect key={`bg-${t.key}`} x={t.box.x - 2} y={t.box.y} width={t.box.w + 4} height={t.box.h} rx={3} fill="var(--surface)" fillOpacity={0.85} pointerEvents="none" />
        ))}
        {tags.map((t) => (
          <text
            key={t.key}
            x={t.tx}
            y={t.ty}
            dy="0.32em"
            textAnchor={t.anchor}
            fontSize={11}
            fill="var(--text-2)"
            stroke="var(--surface)"
            strokeWidth={3}
            paintOrder="stroke"
            pointerEvents="none"
          >
            {t.name}
          </text>
        ))}
      </svg>
      {shown && (
        <div className="kel-tip" style={{ ...tipSide(at.get(shown.key)![0], w, 16), top: Math.max(0, at.get(shown.key)![1] - 12) }} role="status">
          <b className="block text-[13px]">{shown.name}</b>
          {shown.info.map((t) => (
            <span key={t} className="block text-fg-2">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
