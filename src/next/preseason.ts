import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PreStat = { n: number; share: number; rank: number | null; win: number; winCi: number };
export type PreChar = { char: number; weapon: number; key: string; name: string; weaponName: string };
export type PreTier = PreChar & { grade: "S" | "A" | "B" | "C" | "D"; z: number; half: number; n: number; pick: number; win: number; top3: number; place: number };
export type PreData = {
  updatedAt: number;
  season: { id: number; name: string };
  scan: { ids: number; found: number } | null;
  games: number;
  players: number;
  bots: number;
  base: number;
  servers: { name: string; games: number }[];
  from: number;
  to: number;
  exp: { teams: number; rows: (PreStat & { type: string; name: string; step1: number | null; step2: number | null })[]; none: PreStat };
  expChars: (PreChar & { n: number; exp: Record<string, number> })[];
  gadgets: { code: number; name: string; n: number; share: number; per: number | null; multi: number | null }[];
  noGadget: { n: number; share: number };
  weather: { code: number; name: string; games: number; players: number; drop: string | null; dropShare: number; top: (PreChar & PreStat)[] }[];
  tier: { rows: number; thin: number; combos: PreTier[] } | null;
};

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
