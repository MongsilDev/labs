import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type LateRow = { char: number; weapon: number; key: string; name: string; weaponName: string; n: number; top3: number; early: number; earlyCi: number; fin: number; finCi: number };
export type LateData = { from: number; to: number; games: number; cut: number; early: number; fin: number; rows: LateRow[] };

// 수집기의 scripts/er/tier/derive.mjs가 발행 때마다 쓰는 파일
export async function getLate(): Promise<LateData | null> {
  try {
    return JSON.parse(await readFile(join(process.env.DATA_DIR ?? "data", "er-late/late.json"), "utf8"));
  } catch {
    return null;
  }
}
