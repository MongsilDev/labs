// 몽실봇 /api/cut 응답. 계산은 봇의 /이터컷과 같고 여기서는 화면용 파생 값만 계산

export type CutTier = {
  place: number;
  board: number | null;
  cut: number | null;
  estimated: boolean;
  dropped: number | null;
  history: [number, number, number | null][];
  forecast: [number, number, number, number, number][] | null;
  decay: [string, number][];
  decayStay: number;
};

export type CutData = {
  updatedAt: number;
  season: { id: number; name: string; end: number | null };
  rps: number[];
  tiers: { eternity: CutTier; demigod: CutTier };
  quitTicks: Record<GraceKey, number> | null;
  // graceFrom(12.7 점검) 전에는 모두 grace.default
  rule: { grace: Record<GraceKey, number>; graceFrom: number; step: number; floor: number; dormantDays: number };
};

export type GraceKey = "eternity" | "demigod" | "default";

export const TIERS = [
  { key: "eternity", name: "이터니티", color: "var(--et)" },
  { key: "demigod", name: "데미갓", color: "var(--dg)" },
] as const;

export const DAY = 86_400_000;

const KST = 9 * 3_600_000;

/** KST 날짜 m/d */
export function md(at: number): string {
  const d = new Date(at + KST);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** YYYY-MM-DD 문자열을 그날 KST 0시 epoch ms로 */
export function dayStart(ymd: string): number {
  return Date.parse(`${ymd}T00:00:00+09:00`);
}

export const int = (v: number) => Math.round(v).toLocaleString("ko-KR");
export const tens = (v: number) => int(Math.round(v / 10) * 10);

/** 시즌 종료까지 남은 날. 종료일 당일은 0 */
export function daysLeft(end: number, now: number): number {
  return Math.max(0, Math.round((dayStart(new Date(end + KST).toISOString().slice(0, 10)) - dayStart(new Date(now + KST).toISOString().slice(0, 10))) / DAY));
}

/** 순위표 RP 중 a와 b 사이(양 끝 제외) 인원. 순위표가 1000위까지라 더 낮은 쪽이 목록 최저값보다 낮으면 null */
export function between(rps: number[], a: number, b: number): number | null {
  if (!rps.length) return null;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (lo < rps[rps.length - 1]) return null;
  return rps.filter((v) => v > lo && v < hi).length;
}

function phi(z: number): number {
  // Abramowitz-Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** 종료 때 컷이 rp 이하일 확률. 낮은 값과 높은 값을 10%, 90% 지점으로 간주하는 양쪽 정규 근사 */
export function chance(rp: number, mid: number, low: number, high: number): number {
  const z = 1.2816;
  const sd = rp < mid ? Math.max(mid - low, 1) / z : Math.max(high - mid, 1) / z;
  return phi((rp - mid) / sd);
}

export function chanceLabel(p: number): string {
  if (p >= 0.8) return "높음";
  if (p >= 0.55) return "조금 높음";
  if (p >= 0.45) return "중간";
  if (p >= 0.2) return "낮음";
  return "매우 낮음";
}

/** 순위표에서 rp가 들어갈 순위로 정한 유예 티어 */
export function graceKey(data: CutData, rp: number): GraceKey {
  if (!data.rps.length) return "default";
  const rank = data.rps.filter((v) => v > rp).length + 1;
  return rank <= data.tiers.eternity.place ? "eternity" : rank <= data.tiers.demigod.place ? "demigod" : "default";
}

/** 지금부터 랭크 게임을 안 했을 때 시즌 끝 RP. 유예를 다 가진 상태 가정 */
export function quitRp(rp: number, ticks: number, step: number, floor: number): number {
  return Math.max(rp - ticks * step, Math.min(rp, floor));
}
