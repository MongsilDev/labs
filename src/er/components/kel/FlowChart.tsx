"use client";

import { useState } from "react";
import { fmt } from "@/er/lib/format";
import { TEAM, TONES } from "@/er/lib/kel";
import { ticks } from "@/er/lib/ticks";
import { useWidth } from "@/er/lib/useWidth";
import { tipSide } from "./tip";

// cum[팀][r]은 r라운드까지의 누적 점수, order[r]는 그때 순위대로 놓은 팀, 0번은 시작
export default function FlowChart({ cum, order, focus, holders }: { cum: Record<string, number[]>; order: string[][]; focus: string[]; holders: string[][] }) {
  const [ref, w, measured] = useWidth<HTMLDivElement>(900);
  const [at, setAt] = useState<number | null>(null);
  const rounds = order.length - 1;
  const teams = order[rounds];
  // 좁은 화면은 끝 이름표 없이 범례와 툴팁으로 팀을 구분
  const labeled = w >= 560;
  const h = 320;
  const pad = { l: 34, r: labeled ? 168 : 14, t: 14, b: 28 };
  const max = Math.max(...teams.map((k) => Math.max(...cum[k])));
  const ys = ticks(0, max, 5);
  const top = ys[ys.length - 1] || 1;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / rounds;
  const y = (v: number) => pad.t + (1 - v / top) * (h - pad.t - pad.b);
  const toneOf = (k: string) => focus.indexOf(k);
  const path = (k: string) => cum[k].map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  // 강조한 선은 회색 선 위에, 우승 팀 선이 맨 위
  const layer = (k: string) => (toneOf(k) < 0 ? -99 : -toneOf(k));
  // 좁은 화면은 이름표가 없어 회색 선을 빼고 범례에 있는 선만 그림
  const drawn = (labeled ? [...teams] : teams.filter((k) => toneOf(k) >= 0)).sort((a, b) => layer(a) - layer(b));
  const color = (k: string) => (toneOf(k) >= 0 ? TONES[toneOf(k)] : "var(--kel-0)");

  // 끝 이름표가 겹치면 18px씩 띄우고 지시선으로 잇기
  const ends = labeled ? teams.map((k) => ({ k, y: y(cum[k][rounds]), at: 0 })) : [];
  ends.forEach((e, i) => (e.at = Math.max(e.y, i ? ends[i - 1].at + 18 : pad.t)));
  const over = ends.length ? ends[ends.length - 1].at - (h - pad.b) : 0;
  if (over > 0) ends.forEach((e) => (e.at -= over));

  const move = (clientX: number, el: Element) => {
    const box = el.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * w;
    setAt(Math.min(rounds, Math.max(1, Math.round(((px - pad.l) / (w - pad.l - pad.r)) * rounds))));
  };

  return (
    <div ref={ref} className="relative" style={{ visibility: measured ? undefined : "hidden" }}>
      <svg
        width="100%"
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="라운드별 누적 점수"
        tabIndex={0}
        className="[&:not(:focus-visible)]:outline-none"
        style={{ touchAction: "pan-y" }}
        onPointerDown={(e) => move(e.clientX, e.currentTarget)}
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={(e) => e.pointerType !== "touch" && setAt(null)}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && setAt((a) => a ?? rounds)}
        onBlur={() => setAt(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setAt((a) => Math.max(1, (a ?? rounds) - 1));
          if (e.key === "ArrowRight") setAt((a) => Math.min(rounds, (a ?? 0) + 1));
        }}
      >
        {ys.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={x(rounds)} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
            <text x={pad.l - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
              {v}
            </text>
          </g>
        ))}
        {Array.from({ length: rounds + 1 }, (_, i) => (
          <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize={11} fill="var(--text-3)">
            {i === 0 ? "시작" : `${i}R`}
          </text>
        ))}
        {at !== null && <line x1={x(at)} x2={x(at)} y1={pad.t} y2={h - pad.b} stroke="var(--line-strong)" />}
        {drawn.map((k) => (
          <path key={k} d={path(k)} fill="none" stroke={color(k)} strokeWidth={toneOf(k) >= 0 ? 2.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {holders.flatMap((list, r) =>
          list.filter((k) => drawn.includes(k)).map((k) => <circle key={`${k}-${r}`} cx={x(r + 1)} cy={y(cum[k][r + 1])} r={4.5} fill="var(--surface)" stroke={color(k)} strokeWidth={2} />),
        )}
        {ends.map((e) => (Math.abs(e.at - e.y) > 1 ? <line key={e.k} x1={x(rounds) + 3} x2={x(rounds) + 10} y1={e.y} y2={e.at} stroke="var(--line-strong)" /> : null))}
      </svg>
      {measured &&
        ends.map((e) => (
          <span
            key={e.k}
            className={`absolute flex items-center gap-1.5 truncate text-[12px] ${toneOf(e.k) >= 0 ? "font-bold text-fg" : "text-fg-2"}`}
            style={{ left: x(rounds) + 12, top: e.at - 9, height: 18, maxWidth: pad.r - 14 }}
          >
            <span className="h-[3px] w-2.5 flex-none rounded-full" style={{ background: color(e.k) }} aria-hidden="true" />
            <span className="truncate">{TEAM.get(e.k)?.name}</span>
            <span className="font-semibold text-fg">{fmt(cum[e.k][rounds])}</span>
          </span>
        ))}
      {at !== null && (
        <div className="kel-tip" style={{ ...tipSide(x(at), w, 12), top: pad.t }} role="status">
          <b className="block text-[12px] text-fg-3">{at}라운드까지</b>
          {order[at].map((k) => (
            <span key={k} className="flex items-center gap-2">
              <span className="h-[3px] w-2.5 flex-none rounded-full" style={{ background: color(k) }} aria-hidden="true" />
              <b className="w-9 text-right tabular-nums">{fmt(cum[k][at])}</b>
              <span className="truncate text-fg-2">{TEAM.get(k)?.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
