"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

export type Dot = { k: string; x: number; y: number; r: number; fill: string; img: string; weapon: string; name: string; grade?: string; rows: [string, string][] };

// 포인터가 점 한가운데가 아니어도 화면 기준 이 거리 안에서 가장 가까운 점을 고름
const NEAR = 28;

/** under와 over는 점 아래와 위에 그리는 고정 요소. 좌표는 모두 viewBox 기준 */
export default function Dots({ w, h, label, dots, under, over }: { w: number; h: number; label: string; dots: Dot[]; under: React.ReactNode; over?: React.ReactNode }) {
  const [on, setOn] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const order = useMemo(() => dots.map((_, i) => i).sort((a, b) => dots[a].x - dots[b].x), [dots]);
  const cur = on == null ? null : dots[on];

  useEffect(() => {
    if (on == null) return;
    const away = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !box.current?.contains(e.target)) setOn(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [on]);

  const nearest = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = r.width / w;
    const px = (e.clientX - r.left) / s, py = (e.clientY - r.top) / s;
    let best: number | null = null, far = (NEAR / s) ** 2;
    dots.forEach((d, i) => {
      const q = (d.x - px) ** 2 + (d.y - py) ** 2;
      if (q < far) {
        far = q;
        best = i;
      }
    });
    return best;
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return setOn(null);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step || !order.length) return;
    e.preventDefault();
    const at = on == null ? (step > 0 ? -1 : 0) : order.indexOf(on);
    setOn(order[(at + step + order.length) % order.length]);
  };

  const px = cur ? (cur.x / w) * 100 : 0, py = cur ? (cur.y / h) * 100 : 0;
  return (
    <div ref={box} className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block h-auto w-full touch-pan-y"
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e) => e.pointerType === "mouse" && setOn(nearest(e))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setOn(null)}
        onClick={(e) => setOn(nearest(e))}
        // 누를 때는 포커스를 주지 않아 테두리가 생기지 않게 하고, 키보드로 들어온 포커스만 남김
        onMouseDown={(e) => e.preventDefault()}
        onBlur={() => setOn(null)}
        onKeyDown={key}
      >
        {under}
        {dots.map((d) => (
          <circle key={d.k} cx={d.x} cy={d.y} r={d.r} fill={d.fill} stroke="var(--bg)" strokeWidth="1.5" />
        ))}
        {over}
        {cur && (
          <g>
            <circle cx={cur.x} cy={cur.y} r={cur.r + 3} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
            <circle cx={cur.x} cy={cur.y} r={cur.r} fill={cur.fill} />
          </g>
        )}
      </svg>
      {cur && (
        // 가로는 점의 위치 비율만큼 왼쪽으로 당겨 어느 가장자리에서도 그림 안에 남고, 위쪽 점은 아래로 띄움
        <div
          aria-hidden="true"
          className="pointer-events-none absolute z-10 w-max border border-rule-2 bg-bg px-3 py-2 text-[12px] whitespace-nowrap"
          style={{ left: `${px}%`, transform: `translateX(-${px}%)`, ...(py < 32 ? { top: `calc(${py}% + 14px)` } : { bottom: `calc(${100 - py}% + 14px)` }) }}
        >
          <div className="flex items-center gap-2 text-[13px]">
            {cur.grade && <span className={`grade grade-${cur.grade}`}>{cur.grade}</span>}
            <Image className="portrait" src={cur.img} alt="" width={24} height={24} unoptimized />
            <span><span className="text-ink-3">{cur.weapon}</span> <span className="font-semibold">{cur.name}</span></span>
          </div>
          <dl className="m-0 mt-1.5 grid grid-cols-[auto_auto] gap-x-5 gap-y-0.5 num">
            {cur.rows.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-ink-3">{name}</dt>
                <dd className="m-0 text-right font-bold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="sr-only" aria-live="polite">{cur ? `${cur.weapon} ${cur.name}, ${cur.rows.map((r) => r.join(" ")).join(", ")}` : ""}</p>
    </div>
  );
}
