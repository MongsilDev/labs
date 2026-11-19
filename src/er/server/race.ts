import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RaceData } from "@/er/lib/cut";

const FILE = join(process.env.DATA_DIR ?? "data", "er-cut/race.json");
// 정각 회차가 세 번 넘게 쓰지 못했으면 순서가 낡아 이터니티 칸을 원래대로 둠
const STALE = 3 * 3600;

/** 지금 이터컷과 같은 시즌의 열린 선착순만. 없으면 null */
export async function getRace(seasonId: number): Promise<RaceData | null> {
  try {
    const d = JSON.parse(await readFile(FILE, "utf8")) as RaceData;
    return d?.open && d.season === seasonId && Array.isArray(d.list) && Date.now() / 1000 - d.updatedAt <= STALE ? d : null;
  } catch {
    return null;
  }
}
