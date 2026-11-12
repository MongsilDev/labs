import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PreStat = { n: number; share: number; rank: number | null; win: number; winCi: number };
export type PreChar = { char: number; weapon: number; key: string; name: string; weaponName: string };
export type PreMode = {
  id: string;
  label: string;
  games: number;
  players: number;
  bots: number;
  base: number;
  servers: { name: string; games: number }[];
  from: number;
  to: number;
  exp: { teams: number; rows: (PreStat & { type: string; name: string })[]; none: PreStat };
  expChars: (PreChar & { n: number; exp: Record<string, number> })[];
  gadgets: (PreStat & { code: number; name: string })[];
  noGadget: PreStat;
  weather: { code: number; name: string; games: number; players: number; drop: string | null; dropShare: number; top: (PreChar & PreStat)[] }[];
};
export type PreData = { updatedAt: number; season: { id: number; name: string }; scan: { ids: number; found: number } | null; modes: PreMode[] };

// 수집기의 scripts/er/tier/preseason.mjs가 프리 시즌 회차마다 쓰는 파일
export async function getPreseason(): Promise<PreData | null> {
  try {
    return JSON.parse(await readFile(join(process.env.DATA_DIR ?? "data", "er-preseason/preseason.json"), "utf8"));
  } catch {
    return null;
  }
}

export const EXP_ORDER = ["Energy", "Material", "Biotechnology"] as const;
export const EXP_NAME: Record<string, string> = { Energy: "에너지 공학", Material: "재료 공학", Biotechnology: "생명 공학" };
