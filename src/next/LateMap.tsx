import { place } from "./MetaMap";
import type { LateRow } from "./late";

const z = (r: LateRow, early: number, fin: number) => Math.max(Math.abs(r.early - early) / (r.earlyCi / 1.96), Math.abs(r.fin - fin) / (r.finCi / 1.96));

// 가로는 탈락이 적을수록 오른쪽, 세로는 TOP3 중 1위가 높을수록 위
export default function LateMap({ rows, early, fin, cut, w: W = 760, h: H = 520, fs = 12, labels = 18 }: { rows: LateRow[]; early: number; fin: number; cut: number; w?: number; h?: number; fs?: number; labels?: number }) {
  const L = fs * 3, R = 12, T = fs * 2.2, B = fs * 3;
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
    .map((r) => ({ k: key(r), x: sx(r.early), y: sy(r.fin), text: `${r.name} ${r.weaponName}` }));
  const spots = place(named, fs, { x: L, y: T, w: W - L - R, h: H - T - B }, rows.map((r) => [sx(r.early), sy(r.fin)]));
  const q = { fontSize: fs, fontWeight: 700, fill: "var(--ink-3)" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`실험체별 ${Math.round(cut / 60)}분 안에 탈락한 비율과 TOP3 중 1위 비율`}>
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
      <text x={W - R} y={H - 4} textAnchor="end" fontSize={fs} fill="var(--ink-3)">{Math.round(cut / 60)}분 안에 탈락, 오른쪽일수록 적음</text>
      <line x1={L} x2={W - R} y1={sy(fin)} y2={sy(fin)} stroke="var(--rule-2)" strokeDasharray="3 3" />
      <line x1={sx(early)} x2={sx(early)} y1={T} y2={H - B} stroke="var(--rule-2)" strokeDasharray="3 3" />
      <text x={W - R - 4} y={T + fs} textAnchor="end" {...q}>초반에 버티고 막판에 강함</text>
      <text x={L + 6} y={T + fs} {...q}>막판에 강함</text>
      <text x={W - R - 4} y={H - B - 6} textAnchor="end" {...q}>초반에 잘 버팀</text>
      {rows.map((r) => {
        const x = sx(r.early), y = sy(r.fin), k = key(r), at = spots.get(k);
        return (
          <g key={k}>
            <title>{`${r.name} ${r.weaponName}, ${Math.round(cut / 60)}분 안에 탈락 ${r.early.toFixed(1)}%, TOP3 중 1위 ${r.fin.toFixed(1)}%, ${r.n.toLocaleString("ko-KR")}판`}</title>
            <circle cx={x} cy={y} r={at ? fs * 0.42 : fs * 0.33} fill={at ? "var(--ink)" : "var(--ink-3)"} stroke="var(--bg)" strokeWidth="1.5" />
            {at && (
              <text x={at.x} y={at.y} textAnchor={at.anchor} fontSize={fs} fontWeight="600" fill="var(--ink)" paintOrder="stroke" stroke="var(--bg)" strokeWidth="3">
                {r.name} {r.weaponName}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
