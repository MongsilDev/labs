// scripts/er/tier/collect.mjs가 쓰는 tier.json 형식

export type AuthorBadge = "e" | "d";
/** [루트 번호, 플레이어 수, 판 수, 평균 RP 획득, 작성자 배지] */
export type TierRoute = [number, number, number, number | null, AuthorBadge?];
/** [이름, 플레이어 수, 판 수, 평균 RP 획득, 코드] */
export type TierSplit = [string, number, number, number | null, number?];
/** 루트 번호별 [이름, 작성자 닉네임, 핵심 특성 코드, 핵심 특성 이름, 전술 스킬 그룹, 전술 스킬 이름] */
export type TierRouteInfo = [string | null, string | null, number | null, string | null, number | null, string | null];

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
  /** 유효 플레이어 수, 수집기 갱신 전 표에는 없음 */
  ep?: number;
  /** 역할군 한국어 이름, 수집기 갱신 전 표에는 없음 */
  roles?: string[];
  place: number;
  top3: number;
  win: number;
  pick: number;
  /** 상위 1,000명 행 수. 아래 세 표의 비율 분모이고 수집기 갱신 전 표에는 없음 */
  dn?: number;
  /** 상위 1,000명이 쓴 시작 루트, 쓴 플레이어 수 순 3개 */
  routes?: TierRoute[];
  /** 판의 1% 이상인 핵심 특성 */
  traits?: TierSplit[];
  /** 판의 1% 이상인 전술 스킬 */
  tac?: TierSplit[];
};

// 배지를 다는 순위 기준은 scripts/er/tier/collect.mjs의 AUTHOR_BADGE
export const BADGE: Record<AuthorBadge, { label: string; img: string }> = {
  e: { label: "이터니티", img: "/img/er/rank/badge/Immortal.v1.png" },
  d: { label: "데미갓", img: "/img/er/rank/badge/Titan.v1.png" },
};

// public/img/er/trait, tac에 팬키트 아이콘이 있는 코드. 망각과 추진력은 팬키트에 없음
const TRAIT_ICON = new Set([7000201, 7000401, 7000501, 7000601, 7000701, 7100101, 7100201, 7100401, 7100501, 7200101, 7200201, 7200301, 7200501, 7211301, 7300101, 7300201, 7300301]);
const TAC_ICON = new Set([30, 40, 50, 60, 70, 80, 90, 110, 120, 130, 150, 160, 170, 190]);

export function traitIcon(code: number | null | undefined): string | null {
  return code && TRAIT_ICON.has(code) ? `/img/er/trait/${code}.v1.webp` : null;
}

export function tacIcon(code: number | null | undefined): string | null {
  return code && TAC_ICON.has(code) ? `/img/er/tac/${code}.v1.webp` : null;
}

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
  rule: { cap: number; kMin: number; kMax: number; thin: number; few?: number; publishRows: number; weights?: { gain: number; place: number; top3: number } };
  views: TierView[];
  routes?: Record<string, TierRouteInfo>;
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

export type TierMoved = { c: TierCombo; o: TierCombo };

/** 지금 패치 탭이면 비교할 직전 패치 탭 */
export function compareView(views: TierView[], view: TierView, patch: string | null): TierView | undefined {
  if (view.id !== `patch-${patch}` || view.season) return undefined;
  return views.find((v) => v.id.startsWith("patch-") && v.id !== view.id && !v.season);
}

/** 점수 차이의 90% 범위에 0이 들어가지 않는 조합. 차이가 큰 순 */
export function movedCombos(combos: TierCombo[], prev: TierView): TierMoved[] {
  return combos
    .flatMap((c) => {
      const o = prev.combos.find((x) => x.char === c.char && x.weapon === c.weapon);
      return o && c.half != null && o.half != null && Math.abs(c.score - o.score) > Math.hypot(c.half, o.half) ? [{ c, o }] : [];
    })
    .sort((a, b) => Math.abs(b.c.score - b.o.score) - Math.abs(a.c.score - a.o.score));
}
