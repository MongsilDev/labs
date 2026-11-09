export type TierRow = { game: number; player: string; char: number; weapon: number; rank: number; gain: number; mmr?: number };
export type BandRow = { mmr: number; gain: number; rank: number };
export type Metric = "gain" | "place" | "top3";
export type Rule = { cap: number; kMin: number; kMax: number; thin: number; few?: number; bands?: number[]; weights: Record<Metric, number>; k?: Partial<Record<Metric, number>> };
export type Group = { n: number; W: number; eff: number; dev: number; ss: number };
export type ComboScore = Group & {
  char: number;
  weapon: number;
  key: string;
  raw: number;
  players: number;
  ep: number;
  top: number;
  place: number;
  top3: number;
  win: number;
  score: number;
  half: number;
  z: number;
  grade: "S" | "A" | "B" | "C" | "D";
  pick: number;
};

export const RULE: Rule;
export const GRADES: [string, number][];
export function bandAdjust<T extends BandRow>(rows: T[], bands: number[]): (T & { bg: number; bp: number; bt: number })[];
export function grade(z: number): ComboScore["grade"];
export function playerWeights(rows: { player: string }[], cap: number): number[];
export function estimateK(groups: Group[], rule?: Rule): { k: number; within: number; between: number };
export function scoreRows(
  rows: TierRow[],
  rule?: Rule,
): { base: number; games: number; rows: number; k: number; ks: Record<Metric, number>; within: number; between: number; combos: ComboScore[] } | null;
