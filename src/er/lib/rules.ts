export type Mode = "points" | "checkpoint" | "double";
export type Preset = "masters" | "custom";

export type Ban = "none" | "basic" | "strict";

export const BAN_LABEL: Record<Ban, string> = {
  none: "없음",
  basic: "기본: 3명 이상 1R",
  strict: "강화: 3명 1R, 4명 2R, 5명 이상 3R",
};

export type Tiebreak = "killScore" | "kills" | "rankScore" | "wins";

export const TIEBREAK_LABEL: Record<Tiebreak, string> = {
  killScore: "킬 점수가 높은 팀",
  kills: "킬 수가 많은 팀",
  rankScore: "순위 점수 합이 높은 팀",
  wins: "1위를 많이 한 팀",
};

export type Rules = {
  preset: Preset;
  scoreSource: "csv" | "table";
  placementPoints: number[];
  killMultiplier: number;
  tiebreak: Tiebreak;
  deathPenalty: boolean;
  bans: Ban;
  subWeather: boolean;
  advance: number;
  checkpoint: {
    type: "sequential" | "points";
    sequence: number[];
    points: number;
    keep: boolean;
    penaltyKeeps: boolean;
  };
};

export const MAIN_WEATHERS = ["모래바람", "비", "쾌청", "흐림"] as const;
export const SUB_WEATHERS = ["무풍", "강풍", "벼락", "자색안개"] as const;
export const PLACEMENT_POINTS = [10, 7, 5, 4, 3, 2, 1, 0];
export const CHECKPOINT_SEQUENCE = [0, 0, 0, 0, 2, 3, 5, 7, 8];

export const PRESET_LABEL: Record<Preset, string> = {
  masters: "공식 규정",
  custom: "직접 정하기",
};

export const MODE_LABEL: Record<Mode, string> = {
  points: "포인트제",
  checkpoint: "체크포인트",
  double: "더블 체크포인트",
};

export function presetRules(preset: Preset): Rules {
  return {
    preset,
    scoreSource: preset === "custom" ? "table" : "csv",
    placementPoints: [...PLACEMENT_POINTS],
    killMultiplier: 1,
    tiebreak: "killScore",
    deathPenalty: true,
    bans: "strict",
    subWeather: true,
    advance: 0,
    checkpoint: {
      type: "sequential",
      sequence: [...CHECKPOINT_SEQUENCE],
      points: 70,
      keep: false,
      penaltyKeeps: true,
    },
  };
}

export const RULE_PENALTIES = [
  { reason: "지각", points: 5 },
  { reason: "로비 미합류", points: 3 },
  { reason: "승부 포기", points: 3 },
  { reason: "전략맵 이후 로비 귀환", points: 5 },
  { reason: "교체 불가 시기 선수 교체", points: 5 },
  { reason: "스타팅 엔트리 미제출", points: 3 },
] as const;

export const LIMITS = {
  nameLength: 40,
  groups: 8,
  rounds: 12,
  csvBytes: 200_000,
  teamsPerGroup: 8,
  operators: 10,
};

const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const ban = (v: unknown, d: Ban): Ban => (v === true ? "strict" : v === false ? "none" : typeof v === "string" && Object.hasOwn(BAN_LABEL, v) ? (v as Ban) : d);

export function clampRules(input: Partial<Rules> | undefined, preset: Preset): Rules {
  const base = presetRules(preset);
  if (!input) return base;
  const num = (v: unknown, lo: number, hi: number, d: number) => {
    const n = typeof v === "number" && Number.isFinite(v) ? v : d;
    return Math.min(hi, Math.max(lo, n));
  };
  const points = Array.from({ length: LIMITS.teamsPerGroup }, (_, i) =>
    Array.isArray(input.placementPoints) ? num(input.placementPoints[i], -100, 100, 0) : base.placementPoints[i],
  );
  const cp = input.checkpoint ?? base.checkpoint;
  return {
    preset,
    scoreSource: preset === "custom" ? "table" : "csv",
    placementPoints: points,
    killMultiplier: num(input.killMultiplier, 0, 10, 1),
    tiebreak: (["killScore", "kills", "rankScore", "wins"] as const).includes(input.tiebreak as Tiebreak) ? (input.tiebreak as Tiebreak) : "killScore",
    deathPenalty: bool(input.deathPenalty, base.deathPenalty),
    bans: ban(input.bans, base.bans),
    subWeather: bool(input.subWeather, base.subWeather),
    advance: Math.round(num(input.advance, 0, LIMITS.teamsPerGroup, 0)),
    checkpoint: {
      type: cp.type === "points" ? "points" : "sequential",
      sequence: Array.isArray(cp.sequence)
        ? cp.sequence.slice(0, LIMITS.rounds).map((v) => Math.round(num(v, 0, LIMITS.teamsPerGroup, 0)))
        : base.checkpoint.sequence,
      points: num(cp.points, 1, 1000, 70),
      keep: Boolean(cp.keep),
      penaltyKeeps: bool(cp.penaltyKeeps, base.checkpoint.penaltyKeeps),
    },
  };
}

export function groupLabel(index: number): string {
  return String.fromCharCode(65 + index);
}

export function defaultMainWeather(roundNo: number): string {
  return MAIN_WEATHERS[(roundNo - 1) % MAIN_WEATHERS.length];
}
