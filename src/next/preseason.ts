import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PreStat = { n: number; share: number; rank: number | null; win: number; winCi: number };
export type PreChar = { char: number; weapon: number; key: string; name: string; weaponName: string };
export type PreGrade = "S" | "A" | "B" | "C" | "D";
export type PreTier = PreChar & { grade: PreGrade; z: number; half: number; n: number; pick: number; win: number; top3: number; place: number };
export type PreData = {
  updatedAt: number;
  season: { id: number; name: string };
  scan: { ids: number; found: number } | null;
  games: number;
  players: number;
  bots: number;
  base: number;
  servers: { name: string; games: number }[];
  // 아래 modes, cobalt, weather의 share, expChars의 edge는 실험실 개편 전에 쓴 파일에는 없음
  modes?: { mode: number; games: number }[];
  cobalt?: { games: number; teams: number; from: number; to: number; base: number; combos: (PreChar & { grade: PreGrade; n: number; pick: number; win: number; winCi: number })[] } | null;
  from: number;
  to: number;
  exp: { teams: number; rows: (PreStat & { type: string; name: string; step1: number | null; step2: number | null })[]; none: PreStat };
  expChars: (PreChar & {
    n: number;
    exp: Record<string, number>;
    // 분야마다 30명 이상일 때만 값이 있음
    rank?: Record<string, number | null>;
    top3?: Record<string, number | null>;
    // 같은 실험체의 나머지 분야보다 평균 순위가 확실히 좋으면 1, 나쁘면 -1
    edge?: Record<string, number | null>;
  })[];
  trios?: { key: string; members: PreChar[]; n: number; win: number; winCi: number; top3: number; rank: number | null }[];
  // 최종 장비를 저장하기 전에 쓴 파일에는 없음
  equipped?: number;
  equipGames?: number;
  // 직전 정규 시즌 마지막 이틀과 견준 승률 변화. 비교 경기를 모으기 전에는 null
  change?: { games: number; from: number; to: number; avgNow: number; avgThen: number; up: PreMove[]; down: PreMove[] } | null;
  armor?: (PreStat & { code: number; name: string; grade: string; restWin: number | null; restRank: number | null })[];
  weather: { code: number; name: string; games: number; share?: number; players: number; drop: string | null; dropShare: number }[];
  tier: { rows: number; thin: number; combos: PreTier[] } | null;
};

export type PreMove = PreChar & { n: number; win: number; pick: number; d: number; dCi: number; dPick: number };

// 수집기의 scripts/er/tier/preseason.mjs가 프리 시즌 회차마다 쓰는 파일
export async function getPreseason(): Promise<PreData | null> {
  try {
    const data = JSON.parse(await readFile(join(process.env.DATA_DIR ?? "data", "er-preseason/preseason.json"), "utf8"));
    // 모드별로 나눠 쓰던 예전 파일은 다음 집계가 새로 쓸 때까지 없는 것으로 봄
    return data.games ? data : null;
  } catch {
    return null;
  }
}

export const EXP_ORDER = ["Energy", "Material", "Biotechnology"] as const;
export const EXP_NAME: Record<string, string> = { Energy: "에너지 공학", Material: "재료 공학", Biotechnology: "생명 공학" };
