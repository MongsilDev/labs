import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { type CutData, DAY, dayStart, TIERS } from "@/er/lib/cut";

// 정각 회차(scripts/er/tier/hourly.mjs)가 쓰는 파일. 회차를 옮기기 전에는 파일이 없어 몽실봇 /api/cut을 읽음
const FILE = join(process.env.DATA_DIR ?? "data", "er-cut/cut.json");
const URL_ = process.env.CUT_API || "https://bot.mongsil.dev/api/cut";
const TTL = 300_000;
// 차트와 감쇠 달력은 응답의 날짜까지 칸을 만들어서, 받은 시각 앞뒤 1년을 벗어난 날짜가 있는 응답은 쓰지 않음
const SPAN = 366 * DAY;

function usable(d: CutData): boolean {
  const at = d.updatedAt * 1000;
  const near = (ms: number) => Math.abs(ms - at) <= SPAN;
  const end = d.season?.end;
  return (
    at > 0 &&
    at < Date.now() + DAY &&
    (end === null || (typeof end === "number" && near(end * 1000))) &&
    Array.isArray(d.rps) &&
    typeof d.rule?.graceFrom === "number" &&
    TIERS.every(({ key }) => {
      const t = d.tiers?.[key];
      return t && t.history.every(([s]) => near(s * 1000)) && (t.forecast ?? []).every(([s]) => near(s * 1000)) && t.decay.every(([day]) => near(dayStart(day)));
    })
  );
}

let cached: { at: number; data: CutData } | null = null;
let pending: Promise<CutData | null> | null = null;

async function load(): Promise<CutData | null> {
  try {
    const data = JSON.parse(await readFile(FILE, "utf8")) as CutData;
    if (data && usable(data)) {
      cached = { at: Date.now(), data };
      return data;
    }
  } catch {}
  try {
    const res = await fetch(URL_, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as CutData;
    if (!data || !usable(data)) return null;
    cached = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

/** 이터컷 계산 결과. 5분 동안 같은 값, 읽지 못하면 마지막 값이나 null */
export async function getCut(): Promise<CutData | null> {
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  pending ??= load().finally(() => {
    pending = null;
  });
  return (await pending) ?? cached?.data ?? null;
}
