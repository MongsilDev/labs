import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { RaceData } from "@/er/lib/cut";

const FILE = join(process.env.DATA_DIR ?? "data", "er-cut/race.json");
// 1분 수집기가 15분 넘게 쓰지 못했으면 순서가 낡아 이터니티 칸을 원래대로 둠. 한도 응답 뒤 10분 쉬는 것보다 길게
const STALE = 15 * 60;

/** 지금 이터컷과 같은 시즌의 열린 선착순만. 없으면 null */
export async function getRace(seasonId: number): Promise<RaceData | null> {
  try {
    const d = JSON.parse(await readFile(FILE, "utf8")) as RaceData;
    return d?.open && d.season === seasonId && Array.isArray(d.list) && Date.now() / 1000 - d.updatedAt <= STALE ? d : null;
  } catch {
    return null;
  }
}
