import { type CutData, md, TIERS } from "@/er/lib/cut";

const PAST_DAYS = 21;
const W = 600;
const H = 64;

/** 첫 화면용 컷 추이. 지난 3주 휴면 반영 컷과 종료까지 예상 */
export default function CutMini({ data }: { data: CutData }) {
  const now = data.updatedAt * 1000;
  const lines = TIERS.flatMap(({ key, color }) => {
    const tier = data.tiers[key];
    if (tier.cut == null) return [];
    const past = tier.history.slice(-PAST_DAYS).flatMap(([t, , a]) => (a != null ? [[t * 1000, a] as [number, number]] : []));
    const fut = (tier.forecast ?? []).map(([t, mid, lo, hi]) => ({ t: t * 1000, mid, lo, hi }));
    return [{ key, color, cut: tier.cut, past: [...past, [now, tier.cut] as [number, number]], fut }];
  });
  if (!lines.length) return null;
  const ts = lines.flatMap((l) => [...l.past.map(([t]) => t), ...l.fut.map((f) => f.t)]);
  const vs = lines.flatMap((l) => [...l.past.map(([, v]) => v), ...l.fut.flatMap((f) => [f.lo, f.hi])]);
  const [t0, t1] = [Math.min(...ts), Math.max(...ts)];
  const span = Math.max(...vs) - Math.min(...vs) || 1;
  const [v0, v1] = [Math.min(...vs) - span * 0.06, Math.max(...vs) + span * 0.06];
  const x = (t: number) => ((t - t0) / Math.max(t1 - t0, 1)) * W;
  const y = (v: number) => (1 - (v - v0) / (v1 - v0)) * H;
  const path = (pts: [number, number][]) => pts.map(([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const pct = (t: number) => `${((x(t) / W) * 100).toFixed(2)}%`;
  // 종료가 가까우면 「오늘」이 종료 날짜와 겹쳐서 뺌. 가장 좁은 300px 폭에서 두 글자가 닿는 비율
  const near = (W - x(now)) / W < 0.28;
  const ahead = t1 > now;

  return (
    <figure className="mt-4" aria-label={ahead ? "지난 3주 컷과 종료 예상" : "지난 3주 컷"}>
      <div className="relative h-16">
        {/* 가로로 늘려 그리므로 선 굵기는 non-scaling-stroke, 점은 HTML */}
        <svg className="absolute inset-0 size-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1={x(now)} x2={x(now)} y1={0} y2={H} stroke="var(--line-strong)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          {lines.map(({ key, color, cut, past, fut }) => (
            <g key={key}>
              {fut.length > 0 && (
                <path
                  d={`M${x(now)},${y(cut)}` + fut.map((f) => `L${x(f.t).toFixed(1)},${y(f.hi).toFixed(1)}`).join("") + [...fut].reverse().map((f) => `L${x(f.t).toFixed(1)},${y(f.lo).toFixed(1)}`).join("") + "Z"}
                  fill={color}
                  opacity="0.16"
                />
              )}
              <path d={path(past)} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {fut.length > 0 && <path d={path([[now, cut], ...fut.map((f) => [f.t, f.mid] as [number, number])])} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
            </g>
          ))}
        </svg>
        {lines.map(({ key, color, cut, fut }) => (
          <span key={key} className="contents">
            <span className="absolute size-2.5 -translate-1/2 rounded-full border-2 bg-surface" style={{ left: pct(now), top: `${(y(cut) / H) * 100}%`, borderColor: color }} />
            {fut.length > 0 && <span className="absolute size-2 -translate-1/2 rounded-full" style={{ left: "100%", top: `${(y(fut[fut.length - 1].mid) / H) * 100}%`, background: color }} />}
          </span>
        ))}
      </div>
      <div className="relative mt-1 h-4 text-[12px] text-fg-3 tabular-nums">
        <span className="absolute left-0">{md(t0)}</span>
        {!near && (
          <span className="absolute -translate-x-1/2 font-bold text-fg" style={{ left: pct(now) }}>
            오늘
          </span>
        )}
        <span className="absolute right-0 font-bold text-fg">{ahead ? `${md(t1)} 종료` : md(t1)}</span>
      </div>
    </figure>
  );
}
