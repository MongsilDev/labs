import Dots, { type Dot } from "./Dots";
import type { Spot } from "./meta";

type Box = { x: number; y: number; w: number; h: number };
const hit = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// 이름표는 점 오른쪽에 두고, 겹치면 왼쪽으로 옮기며, 두 자리 모두 겹치면 뺌
export function place(points: { k: string; x: number; y: number; text: string }[], fs: number, box: Box, dots: [number, number][], fixed: Box[] = []) {
  const taken: Box[] = [...fixed, ...dots.map(([x, y]) => ({ x: x - 4, y: y - 4, w: 8, h: 8 }))];
  const out = new Map<string, { x: number; y: number; anchor: "start" | "end" }>();
  for (const p of points) {
    const w = p.text.length * fs * 0.92, h = fs + 2;
    const tries: [number, number, "start" | "end"][] = [
      [p.x + 8, p.y + fs * 0.35, "start"],
      [p.x - 8, p.y + fs * 0.35, "end"],
    ];
    for (const [tx, ty, anchor] of tries) {
      const left = anchor === "start" ? tx : tx - w;
      const b = { x: left, y: ty - fs, w, h };
      if (b.x < box.x || b.x + b.w > box.x + box.w || b.y < box.y || b.y + b.h > box.y + box.h) continue;
      if (taken.some((t) => hit(t, b))) continue;
      taken.push(b);
      out.set(p.k, { x: tx, y: ty, anchor });
      break;
    }
  }
  return out;
}

export default function MetaMap({ list, median, label, w: W = 860, h: H = 540, fs = 12 }: { list: Spot[]; median: number; label: Set<string>; w?: number; h?: number; fs?: number }) {
  const L = fs * 3, R = 12, T = fs * 2.2, B = fs * 3.3;
  const xs = list.map((c) => Math.log10(Math.max(c.pick, 0.01)));
  const x0 = Math.min(...xs) - 0.05, x1 = Math.max(...xs) + 0.05;
  const ys = list.map((c) => c.score);
  const y0 = Math.floor(Math.min(...ys) - 0.5), y1 = Math.ceil(Math.max(...ys) + 0.5);
  const sx = (p: number) => L + ((Math.log10(Math.max(p, 0.01)) - x0) / (x1 - x0)) * (W - L - R);
  const sy = (s: number) => T + ((y1 - s) / (y1 - y0)) * (H - T - B);
  const ticksX = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].filter((p) => Math.log10(p) >= x0 && Math.log10(p) <= x1);
  const ticksY: number[] = [];
  for (let v = Math.ceil(y0 / 2) * 2; v <= y1; v += 2) ticksY.push(v);
  const mx = sx(median), zy = sy(0);
  const key = (c: Spot) => `${c.char}-${c.weapon}`;
  const named = list
    .filter((c) => label.has(key(c)))
    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
    .map((c) => ({ k: key(c), x: sx(c.pick), y: sy(c.score), text: `${c.weaponName} ${c.name}` }));
  // 사분면 이름이 차지한 자리. 이름표가 그 위에 놓이지 않게 함
  const cw = (text: string) => text.length * fs * 0.92;
  const QUADS: [string, "start" | "end", number][] = [["많이 쓰고 강함", "end", T + fs], ["적게 쓰지만 강함", "start", T + fs], ["많이 쓰지만 약함", "end", H - B - 6]];
  const fixed = QUADS.map(([text, anchor, y]) => ({ x: anchor === "end" ? W - R - 4 - cw(text) : L + 6, y: y - fs, w: cw(text), h: fs + 4 }));
  const spots = place(named, fs, { x: L, y: T, w: W - L - R, h: H - T - B }, list.map((c) => [sx(c.pick), sy(c.score)]), fixed);
  const q = { fontSize: fs, fontWeight: 700, fill: "var(--ink-3)" };
  // 그려진 글자 폭의 어림값. 한글은 글자 크기만큼, 공백과 영문과 기호는 그보다 좁음
  const tw = (text: string) => [...text].reduce((w, ch) => w + (ch === " " ? 0.28 : /[\u3131-\uD7A3]/.test(ch) ? 0.93 : 0.62), 0) * fs;
  const labels = named.flatMap((p) => { const at = spots.get(p.k); return at ? [{ k: p.k, text: p.text, at }] : []; });
  const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);
  const dots: Dot[] = list.map((c) => ({
    k: key(c),
    x: sx(c.pick),
    y: sy(c.score),
    r: spots.has(key(c)) ? fs * 0.42 : fs * 0.33,
    fill: `var(--g-${c.grade.toLowerCase()})`,
    img: `/img/er/char/${c.key}.v1.webp`,
    weapon: c.weaponName,
    name: c.name,
    grade: c.grade,
    rows: [["점수", signed(c.score)], ...(c.half != null ? [["90% 범위", `±${c.half}`] as [string, string]] : []), ["픽률", `${c.pick.toFixed(2)}%`], ["판", c.n.toLocaleString("ko-KR")]],
  }));
  return (
    <Dots
      w={W}
      h={H}
      label="실험체별 점수와 픽률"
      dots={dots}
      under={
        <>
          <text x={4} y={fs} fontSize={fs} fill="var(--ink-3)">점수</text>
          {ticksY.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="var(--rule)" />
              <text x={L - 6} y={sy(v) + fs * 0.35} textAnchor="end" fontSize={fs} fill="var(--ink-3)" className="num">{signed(v)}</text>
            </g>
          ))}
          {ticksX.map((p) => (
            <text key={p} x={sx(p)} y={H - B + fs * 1.35} textAnchor="middle" fontSize={fs} fill="var(--ink-3)" className="num">{p}%</text>
          ))}
          <text x={W - R} y={H - 4} textAnchor="end" fontSize={fs} fill="var(--ink-3)">픽률</text>
          <line x1={L} x2={W - R} y1={zy} y2={zy} stroke="var(--rule-2)" />
          <line x1={mx} x2={mx} y1={T} y2={H - B} stroke="var(--rule-2)" strokeDasharray="3 3" />
          <text x={mx} y={H - 4} textAnchor="middle" fontSize={fs} fill="var(--ink-3)" className="num">중앙값 {median}%</text>
          {QUADS.map(([text, anchor, y]) => (
            <text key={text} x={anchor === "end" ? W - R - 4 : L + 6} y={y} textAnchor={anchor} {...q}>{text}</text>
          ))}
          {/* 눈금선이 글자를 지나가지 않게 이름표 자리를 바탕색으로 덮음. 점보다 먼저 그려 이웃 점을 가리지 않음 */}
          {labels.map(({ k, text, at }) => (
            <rect key={k} x={at.anchor === "start" ? at.x - 2 : at.x - tw(text) - 2} y={at.y - fs} width={tw(text) + 4} height={fs + 4} fill="var(--bg)" />
          ))}
        </>
      }
      over={labels.map(({ k, text, at }) => (
        <text key={k} x={at.x} y={at.y} textAnchor={at.anchor} fontSize={fs} fontWeight="600" fill="var(--ink)" paintOrder="stroke" stroke="var(--bg)" strokeWidth="3">{text}</text>
      ))}
    />
  );
}
