import "server-only";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { TierData } from "@/er/lib/tier";

// 호스트 수집기가 임시 파일에 쓴 뒤 이름을 바꿔 넣는 파일
const file = () => join(process.env.DATA_DIR || join(process.cwd(), "data"), "er-tier", "tier.json");

let cached: { mtime: number; data: TierData } | null = null;

function usable(d: TierData): boolean {
  return d?.version === 1 && typeof d.updatedAt === "number" && Array.isArray(d.views) && d.views.every((v) => Array.isArray(v.combos));
}

/** 수집기 집계 결과. 파일이 없거나 형식이 다르면 null */
export async function getTier(): Promise<TierData | null> {
  try {
    const { mtimeMs } = await stat(file());
    if (cached?.mtime === mtimeMs) return cached.data;
    const data = JSON.parse(await readFile(file(), "utf8")) as TierData;
    if (!usable(data)) return cached?.data ?? null;
    cached = { mtime: mtimeMs, data };
    return data;
  } catch {
    return cached?.data ?? null;
  }
}
