// scripts/er/tier/collect.mjs가 쓰는 tier.json 형식

export type AuthorBadge = "e" | "d";
/** [루트 번호, 플레이어 수, 판 수, 평균 RP 획득, 작성자 배지] */
export type TierRoute = [number, number, number, number | null, AuthorBadge?];
/** [이름, 플레이어 수, 판 수, 평균 RP 획득, 코드] */
export type TierSplit = [string, number, number, number | null, number?];
/**
 * 루트 번호별 [이름, 작성자 닉네임, 핵심 특성 코드, 핵심 특성 이름, 전술 스킬 그룹, 전술 스킬 이름, 목표 아이템 코드, 지역 이름 순서, 패치, dak.gg 본문 여부].
 * 게임이 본문을 주지 않는 루트는 dak.gg 본문을 쓰고 마지막 칸이 1. dak.gg에도 없으면 아이템, 지역, 패치가 null이고 특성과 전술 스킬은 그 루트로 한 판에서 가장 많이 고른 값. 11-10 전 표는 앞 6칸만 있음
 */
export type TierRouteInfo = [string | null, string | null, number | null, string | null, number | null, string | null, (number[] | null)?, (string[] | null)?, (string | null)?, (1 | null)?];
/** 상위 1,000명 판당 평균 [킬, 어시스트, 사망, 피해량, 몬스터 처치] */
export type TierItem = [name: string, grade: string | null];
export type TierMetric = [number, number, number, number, number];
export const METRIC_LABELS = ["킬", "어시스트", "사망", "피해량", "몬스터 처치"] as const;

/** 게임과 dak.gg 어디서도 본문을 받지 못한 루트. 11-10 전 표는 모두 null인 6칸 */
export function hiddenRoute(info: TierRouteInfo | undefined): boolean {
  if (!info) return false;
  return info.length > 6 ? info[6] == null : info.every((x) => x == null);
}

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
  /** 상위 1,000명이 쓴 시작 루트, 쓴 플레이어 수 순. 상위 3개와 2명 이상이 쓴 루트를 20개까지 */
  routes?: TierRoute[];
  /** 경기 시각의 300위 RP 이상인 판 수와 그 판들의 루트 */
  tn?: number;
  routesTop?: TierRoute[];
  /** 판의 1% 이상인 핵심 특성 */
  traits?: TierSplit[];
  /** 판의 1% 이상인 전술 스킬 */
  tac?: TierSplit[];
  /** 상위 1,000명 행의 경기 지표, 11-10 전 표에는 없음 */
  metric?: TierMetric;
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

// public/img/er/item에 아이콘이 있는 루트 목표 아이템 코드. 팬키트에 없는 것은 scripts/er/tier/dakicons.mjs로 dak.gg에서 받음
const ITEM_ICON = new Set<number>([101401, 101402, 101404, 101406, 101407, 101408, 102405, 102406, 102407, 102408, 102410, 102411, 102413, 103401, 103403, 103404, 103501, 103506, 104401, 104402, 104403, 104406, 104407, 104408, 104409, 105402, 105403, 105404, 105405, 105406, 107403, 107405, 107407, 107408, 108403, 108404, 108501, 109401, 109403, 109404, 109405, 110405, 110406, 110407, 110408, 110409, 110410, 110411, 111402, 111403, 111404, 111406, 112302, 112401, 112402, 112408, 112501, 113401, 113405, 113406, 113410, 114401, 114403, 114406, 114501, 115402, 115403, 115404, 115406, 116404, 116405, 116406, 116407, 116409, 117403, 117404, 117405, 117407, 117501, 118403, 118405, 118406, 118407, 119301, 119401, 119402, 119404, 120302, 120401, 120403, 120406, 120407, 120408, 121401, 121402, 121403, 121404, 121406, 121407, 122402, 122404, 122405, 130401, 130402, 130403, 130404, 131301, 131302, 131303, 131401, 131402, 131403, 201304, 201305, 201404, 201405, 201406, 201407, 201409, 201410, 201412, 201413, 201414, 201416, 201417, 201418, 201419, 201420, 201421, 201422, 201531, 201538, 202104, 202307, 202402, 202404, 202405, 202406, 202408, 202410, 202411, 202412, 202413, 202417, 202418, 202419, 202420, 202422, 202423, 202424, 202532, 203306, 203402, 203403, 203405, 203406, 203407, 203409, 203410, 203411, 203412, 203414, 203415, 203506, 204303, 204304, 204401, 204402, 204403, 204406, 204408, 204411, 204412, 204415, 204416, 204417, 204418, 204419, 204515, 205201, 205304, 205308, 205309, 205404, 205405]);

// 팬키트 반신 그림이 있는 실험체. 새 실험체는 그림을 더할 때 함께 적음
const HALF_ART = new Set<string>(["Abigail", "Adela", "Adina", "Adriana", "Aiden", "Alex", "Alonso", "Arda", "Aya", "Barbara", "Bernice", "Bianca", "Bihyung", "Blair", "Camilo", "Cathy", "Celine", "Charlotte", "Chiara", "Chloe", "Coraline", "Craver", "Daniel", "Darko", "DebiMarlene", "Echion", "Elena", "Eleven", "Emma", "Estelle", "Eva", "Felix", "Fenrir", "Fiora", "Garnet", "Hart", "Haze", "Henry", "Hisui", "Hyejin", "Hyunwoo", "Irem", "Isaac", "Isol", "Jackie", "Jan", "Jenny", "Johann", "Justyna", "Karla", "Katja", "Kenneth", "Laura", "Leni", "Lenore", "Lenox", "Leon", "LiDailin", "Lucia", "Luke", "Lyanh", "Magnus", "Mai", "Markus", "Martina", "Mirka", "Nadine", "Nathapon", "Niah", "Nicky", "Piolo", "Priya", "Rio", "Rozzi", "Seres", "Shoichi", "Silvia", "Sissela", "Sua", "Tazia", "Theodore", "Tia", "Tsubame", "Vanya", "William", "Xiukai", "Xuelin", "YuMin", "Yuki", "Zahir"]);

export function halfArt(key: string): string | null {
  return HALF_ART.has(key) ? `/img/er/half/${key}.v1.webp` : null;
}

export function itemIcon(code: number | null | undefined): string | null {
  return code && ITEM_ICON.has(code) ? `/img/er/item/${code}.v1.webp` : null;
}

// 상세 주소에 쓰는 무기 영문 이름. scripts/er/tier/collect.mjs의 WEAPON을 소문자로 바꾼 값
const WEAPON_KEY: Record<number, string> = {
  1: "glove", 2: "tonfa", 3: "bat", 4: "whip", 5: "highanglefire", 6: "directfire", 7: "bow", 8: "crossbow", 9: "pistol", 10: "assaultrifle", 11: "sniperrifle",
  13: "hammer", 14: "axe", 15: "onehandsword", 16: "twohandsword", 18: "dualsword", 19: "spear", 20: "nunchaku", 21: "rapier", 22: "guitar", 23: "camera", 24: "arcana", 25: "vfarm",
};

/** 실험체 상세 주소의 마지막 칸. 예: garnet-bat */
export function comboSlug(c: { key: string; weapon: number }): string {
  return `${c.key.toLowerCase()}-${WEAPON_KEY[c.weapon] ?? c.weapon}`;
}

/** 기본 탭이면 v를 빼 공유 주소를 짧게 둠 */
export function comboPath(c: { key: string; weapon: number }, view?: string | null): string {
  return `/er/tier/${comboSlug(c)}${view ? `?v=${encodeURIComponent(view)}` : ""}`;
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
  // 픽률 분모. 팀 수를 싣기 전에 쓴 파일에는 없음
  teams?: number;
  base: number;
  k: number;
  ks?: { gain: number; place: number; top3: number };
  /** 이 탭 상위 1,000명 전체의 경기 지표 */
  metric?: TierMetric;
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
  /** 루트 목표 아이템 코드별 한국어 이름과 등급(Epic 같은 게임 값) */
  items?: Record<string, TierItem>;
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

/** 지금 시즌 탭 뒤에 지난 시즌 탭을 붙임. 지난 시즌 탭은 화면에서 시즌 이름을 붙여 구분 */
export function allViews(data: TierData): TierView[] {
  return [...data.views, ...(data.past?.views.map((x) => ({ ...x, season: data.past!.season.name })) ?? [])];
}

/** 주소의 v가 없으면 지금 보여 줄 패치 표. 새 패치가 기준 전이면 직전 패치 */
export function pickView(data: TierData, id?: string): TierView | null {
  const asked = data.views.find((v) => v.id === id);
  if (asked) return asked;
  const patches = data.views.filter((v) => v.id.startsWith("patch-"));
  return patches.find((v) => v.ready) ?? patches[0] ?? data.views[0] ?? null;
}

// public/img/er/weapons.v2.png에 무기 아이콘을 놓은 순서. 무기 코드
// 팬키트 원본에서 활, 석궁, 권총, 레이피어 칸만 획을 굵게 함
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

const GRADE_RANK: TierCombo["grade"][] = ["S", "A", "B", "C", "D"];

/** 표 정렬. 점수는 소수 한 자리, z는 두 자리로 반올림된 값이고 등급은 반올림 전 z로 정해져서, 점수가 같으면 등급, z, 판 수 순으로 가름 */
export function sortCombos(list: TierCombo[], val: (c: TierCombo) => number, dir: "asc" | "desc", byScore: boolean): TierCombo[] {
  const s = dir === "asc" ? 1 : -1;
  const tie = (a: TierCombo, b: TierCombo) => s * (GRADE_RANK.indexOf(b.grade) - GRADE_RANK.indexOf(a.grade)) || s * (a.z - b.z);
  return [...list].sort((a, b) => s * (val(a) - val(b)) || (byScore ? tie(a, b) : 0) || b.n - a.n);
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
