// scripts/er/tier/collect.mjs가 쓰는 tier.json 형식

export type TierCombo = {
  char: number;
  key: string;
  name: string;
  weapon: number;
  weaponName: string;
  grade: "S" | "A" | "B" | "C" | "D";
  score: number;
  /** 점수 90% 범위의 오차 ±, 수집기 갱신 전 표에는 없음 */
  half?: number;
  raw: number;
  z: number;
  n: number;
  players: number;
  top: number;
  /** 판을 가장 많이 한 3명의 판 비율 %, 수집기 갱신 전 표에는 없음 */
  lead3?: number;
  place: number;
  top3: number;
  win: number;
  pick: number;
};

export type TierView = {
  id: string;
  label: string;
  patch: string;
  days?: number;
  ready?: boolean;
  /** 수집 시작 뒤 경기만 담은 패치 */
  partial?: boolean;
  /** 날짜로 센 기간에 섞인 패치, 둘 이상일 때만 */
  patches?: string[];
  /** 지난 시즌 표에서 남긴 탭의 시즌 이름. 화면에서만 붙임 */
  season?: string;
  from: number;
  to: number;
  rows: number;
  games: number;
  base: number;
  k: number;
  ks?: { gain: number; place: number; top3: number };
  combos: TierCombo[];
};

export type TierData = {
  version: 1;
  updatedAt: number;
  season: { id: number; name: string; end: number };
  state: "shown" | "collecting" | "offseason";
  patch: string | null;
  band: { name: string; server: string; floor: number; cut: number | null };
  rule: { cap: number; kMin: number; kMax: number; thin: number; publishRows: number; weights?: { gain: number; place: number; top3: number } };
  views: TierView[];
  /** 새 시즌 첫 집계 때 남긴 지난 시즌 마지막 표의 패치 탭 */
  past?: { season: { id: number; name: string; end: number }; views: TierView[] };
  /** 새 정규 시즌이 시작됐지만 집계할 행이 아직 없을 때 그 시즌 이름 */
  next?: string;
};

// scripts/er/tier/score.mjs의 GRADES와 같은 값. 화면 설명용
export const TIER_BOUNDS: [TierCombo["grade"], number][] = [
  ["S", 1],
  ["A", 0.3],
  ["B", -0.3],
  ["C", -1],
];

/** 주소의 v가 없으면 지금 보여 줄 패치 표. 새 패치가 기준 전이면 직전 패치 */
export function pickView(data: TierData, id?: string): TierView | null {
  const asked = data.views.find((v) => v.id === id);
  if (asked) return asked;
  const patches = data.views.filter((v) => v.id.startsWith("patch-"));
  return patches.find((v) => v.ready) ?? patches[0] ?? data.views[0] ?? null;
}

// public/img/er/weapons.v1.png에 무기 아이콘을 놓은 순서. 무기 코드
export const WEAPON_SPRITE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 25];

export function signed(v: number): string {
  const r = Math.round(v * 10) / 10;
  return r > 0 ? `+${r.toFixed(1)}` : r < 0 ? r.toFixed(1) : "0.0";
}
