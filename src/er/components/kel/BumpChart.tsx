"use client";

import { useState } from "react";
import { TEAM, TONES } from "@/er/lib/kel";
import { Logo } from "./Team";
import { useWidth } from "@/er/lib/useWidth";

type Row = { key: string; ranks: number[] };

// 강조는 3팀까지, 새로 고르면 가장 먼저 고른 팀이 빠지고 남은 팀은 색을 그대로 유지
function pick(picked: { key: string; tone: number }[], key: string) {
  if (picked.some((p) => p.key === key)) return picked.filter((p) => p.key !== key);
  const kept = picked.length >= TONES.length ? picked.slice(1) : picked;
  const tone = TONES.findIndex((_, i) => !kept.some((p) => p.tone === i));
  return [...kept, { key, tone }];
}

// 열 이름만으로 무슨 순위인지 안 드러날 때 legend와 suffix로 머리글과 툴팁 문구를 바꿈. 빈 legend는 머리글을 뺌
export default function BumpChart({ rows, labels, initial, legend, suffix = "" }: { rows: Row[]; labels: string[]; initial: string[]; legend?: string; suffix?: string }) {
  const [ref, w, measured] = useWidth<HTMLDivElement>(900);
  const [picked, setPicked] = useState(() => initial.slice(0, TONES.length).map((key, tone) => ({ key, tone })));
  const [hover, setHover] = useState<string | null>(null);
  const narrow = w < 560;
  const step = 26;
  const pad = { l: narrow ? 32 : 40, r: narrow ? 144 : 176, t: legend === "" ? 12 : 32, b: 30 };
  const h = pad.t + step * (rows.length - 1) + pad.b;
  const x = (i: number) => pad.l + 8 + (i * (w - pad.l - pad.r - 16)) / (labels.length - 1);
  const y = (rank: number) => pad.t + (rank - 1) * step;
  const toneOf = (key: string) => picked.find((p) => p.key === key)?.tone ?? -1;
  const points = (r: Row) => r.ranks.map((k, i) => `${x(i)},${y(k)}`).join(" ");
  const last = labels.length - 1;
  // 세로선 간격이 '서킷 1' 글자 폭보다 좁으면 번호만 씀
  const tight = (w - pad.l - pad.r - 16) / last < 44;
  const ticksY = [1, 4, 8, 12, 16].filter((r) => r <= rows.length);

  return (
    <div ref={ref} className="relative" style={{ visibility: measured ? undefined : "hidden" }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${labels[0]}부터 ${labels[last]}까지 팀 순위 변화`}>
        {labels.map((l, i) => (
          <g key={l}>
            <line x1={x(i)} x2={x(i)} y1={pad.t - 8} y2={h - pad.b + 6} stroke="var(--line-soft)" />
            <text x={x(i)} y={h - 8} textAnchor="middle" fontSize={12} fill="var(--text-3)">
              {tight ? l.split(" ").at(-1) : l}
            </text>
          </g>
        ))}
        {legend !== "" && (
          <text x={x(last) + 12} y={14} fontSize={12} fill="var(--text-3)">
            {legend ?? `${labels[last]} 순위`}
          </text>
        )}
        {ticksY.map((r) => (
          <text key={r} x={pad.l - 4} y={y(r)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--text-3)">
            {r}위
          </text>
        ))}
        {rows
          .filter((r) => toneOf(r.key) < 0 && r.key !== hover)
          .map((r) => (
            <g key={r.key}>
              <polyline points={points(r)} fill="none" stroke="var(--kel-0)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {r.ranks.map((k, i) => (
                <circle key={i} cx={x(i)} cy={y(k)} r={3} fill="var(--kel-0)" />
              ))}
            </g>
          ))}
        {/* 범례에 마우스를 올린 팀은 고른 팀이 아니어도 선을 굵게 */}
        {rows
          .filter((r) => toneOf(r.key) >= 0 || r.key === hover)
          .sort((a, b) => toneOf(a.key) - toneOf(b.key))
          .map((r) => {
            const color = toneOf(r.key) >= 0 ? TONES[toneOf(r.key)] : "var(--text-2)";
            return (
              <g key={r.key}>
                <polyline points={points(r)} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                {r.ranks.map((k, i) => (
                  <circle key={i} cx={x(i)} cy={y(k)} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2}>
                    <title>{`${TEAM.get(r.key)?.name} ${labels[i]}${suffix} ${k}위`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
      </svg>
      {measured &&
        rows.map((r) => {
          const team = TEAM.get(r.key)!;
          const tone = toneOf(r.key);
          return (
            <button
              key={r.key}
              type="button"
              aria-pressed={tone >= 0}
              onClick={() => setPicked((p) => pick(p, r.key))}
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r.key)}
              onBlur={() => setHover(null)}
              className="absolute flex items-center gap-1.5 rounded-md px-1 text-left hover:bg-hover"
              style={{ left: x(last) + 8, top: y(r.ranks[last]) - 11, height: 22, maxWidth: pad.r - 10 }}
            >
              <span className="h-[3px] w-2.5 flex-none rounded-full" style={{ background: tone >= 0 ? TONES[tone] : "var(--kel-0)" }} aria-hidden="true" />
              <Logo team={team} size={18} />
              <span className={`truncate text-[13px] max-[560px]:text-[12px] ${tone >= 0 || r.key === hover ? "font-bold text-fg" : "text-fg-2"}`}>{team.name}</span>
            </button>
          );
        })}
    </div>
  );
}
