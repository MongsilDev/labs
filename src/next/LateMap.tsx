import Dots, { type Dot } from "./Dots";
import { place } from "./MetaMap";
import type { LateRow } from "./late";

const z = (r: LateRow, early: number, fin: number) => Math.max(Math.abs(r.early - early) / (r.earlyCi / 1.96), Math.abs(r.fin - fin) / (r.finCi / 1.96));

// 가로는 탈락이 적을수록 오른쪽, 세로는 TOP3 중 1위가 높을수록 위
export default function LateMap({ rows, early, fin, cut, w: W = 760, h: H = 520, fs = 12, labels = 18 }: { rows: LateRow[]; early: number; fin: number; cut: number; w?: number; h?: number; fs?: number; labels?: number }) {
  // 사분면 이름은 점과 겹치지 않게 그림 위쪽 여백에 두고, 가로축 설명은 눈금 아래 줄에 둠
  const L = fs * 3, R = 12, T = fs * 3.6, B = fs * 3.8;
  const ex = rows.map((r) => r.early), fy = rows.map((r) => r.fin);
  const x0 = Math.floor(Math.min(...ex) - 1), x1 = Math.ceil(Math.max(...ex) + 1);
  const y0 = Math.floor(Math.min(...fy) - 1), y1 = Math.ceil(Math.max(...fy) + 1);
  const sx = (v: number) => L + ((x1 - v) / (x1 - x0)) * (W - L - R);
  const sy = (v: number) => T + ((y1 - v) / (y1 - y0)) * (H - T - B);
  const ticksX: number[] = [], ticksY: number[] = [];
  for (let v = Math.ceil(x0 / 2) * 2; v <= x1; v += 2) ticksX.push(v);
  for (let v = Math.ceil(y0 / 5) * 5; v <= y1; v += 5) ticksY.push(v);
  const key = (r: LateRow) => `${r.char}-${r.weapon}`;
  const named = [...rows]
    .sort((a, b) => z(b, early, fin) - z(a, early, fin))
    .slice(0, labels)
    .map((r) => ({ k: key(r), x: sx(r.early), y: sy(r.fin), text: `${r.weaponName} ${r.name}` }));
  const spots = place(named, fs, { x: L, y: T, w: W - L - R, h: H - T - B }, rows.map((r) => [sx(r.early), sy(r.fin)]));
  const q = { fontSize: fs, fontWeight: 700, fill: "var(--ink-3)" };
  const min = Math.round(cut / 60);
  const dots: Dot[] = rows.map((r) => ({
    k: key(r),
    x: sx(r.early),
    y: sy(r.fin),
    r: spots.has(key(r)) ? fs * 0.42 : fs * 0.33,
    fill: spots.has(key(r)) ? "var(--ink)" : "var(--ink-3)",
    img: `/img/er/char/${r.key}.v1.webp`,
    weapon: r.weaponName,
    name: r.name,
    rows: [[`${min}분 안에 탈락`, `${r.early.toFixed(1)}%`], ["TOP3 중 1위", `${r.fin.toFixed(1)}%`], ["판", r.n.toLocaleString("ko-KR")]],
  }));
  return (
    <Dots
      w={W}
      h={H}
      label={`실험체별 ${min}분 안에 탈락한 비율과 TOP3 중 1위 비율`}
      dots={dots}
      under={
        <>
          <text x={4} y={fs} fontSize={fs} fill="var(--ink-3)">TOP3 중 1위</text>
          {ticksY.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={sy(v)} y2={sy(v)} stroke="var(--rule)" />
              <text x={L - 6} y={sy(v) + fs * 0.35} textAnchor="end" fontSize={fs} fill="var(--ink-3)" className="num">{v}%</text>
            </g>
          ))}
          {ticksX.map((v) => (
            <text key={v} x={sx(v)} y={H - B + fs * 1.6} textAnchor="middle" fontSize={fs} fill="var(--ink-3)" className="num">{v}%</text>
          ))}
          <text x={W - R} y={H - 4} textAnchor="end" fontSize={fs} fill="var(--ink-3)">{min}분 안에 탈락, 오른쪽일수록 적음</text>
          <line x1={L} x2={W - R} y1={sy(fin)} y2={sy(fin)} stroke="var(--rule-2)" strokeDasharray="3 3" />
          <line x1={sx(early)} x2={sx(early)} y1={T} y2={H - B} stroke="var(--rule-2)" strokeDasharray="3 3" />
          <text x={W - R} y={T - 8} textAnchor="end" {...q}>초반에 버티고 막판에 강함</text>
          <text x={L} y={T - 8} {...q}>막판에 강함</text>
          <text x={W - R - 4} y={H - B - 6} textAnchor="end" {...q}>초반에 잘 버팀</text>
        </>
      }
      over={named.flatMap((p) => {
        const at = spots.get(p.k);
        return at ? [<text key={p.k} x={at.x} y={at.y} textAnchor={at.anchor} fontSize={fs} fontWeight="600" fill="var(--ink)" paintOrder="stroke" stroke="var(--bg)" strokeWidth="3">{p.text}</text>] : [];
      })}
    />
  );
}
