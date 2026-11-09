import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type Cell = { n: number; m: number | null; ci: number | null };
export type RpHour = { h: number; gain: number; ci: number; n: number };
export type RpBand = { lo: number; hi: number; n: number; entry: number; tkAvg: number; cells: Cell[][]; hours: RpHour[] };
export type RpData = { from: number; to: number; games: number; rows: number; tk: [number, number][]; bands: RpBand[] };

// 시제품은 원본에서 미리 계산한 파일을 읽음. 수집기에 넣을지는 결정 뒤에 정함
export async function getRp(): Promise<RpData | null> {
  try {
    return JSON.parse(await readFile(join(process.env.DATA_DIR ?? "data", "er-rp/rp.json"), "utf8"));
  } catch {
    return null;
  }
}

export const MIN_N = 30;

// 순위마다 평균이 0 이상이 되는 첫 처치 구간. 표본이 모자란 칸은 건너뛰고, 그런 칸이 없으면 null
export function breakEven(band: RpBand): (number | null)[] {
  return band.cells.map((row) => {
    const i = row.findIndex((c) => c.n >= MIN_N && c.m != null && c.m >= 0);
    return i < 0 ? null : i;
  });
}
