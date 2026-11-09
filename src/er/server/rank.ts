import "server-only";
import { botApiUrl } from "./bot";
import type { RankView } from "@/er/lib/rank";

const TTL = 60_000;
const MISS_TTL = 60_000;
const FAIL_TTL = 15_000;
const MAX_ENTRIES = 2000;
export const NICKNAME = /^[\p{L}\p{N}_]{2,16}$/u;

export type RankResult = { ok: true; data: RankView } | { ok: false; status: 404 | 429 | 503 };
type Entry = { at: number; result: RankResult };

const g = globalThis as unknown as { __rank?: Map<string, Entry>; __rankPending?: Map<string, Promise<RankResult>> };
const cache = (g.__rank ??= new Map());
const pending = (g.__rankPending ??= new Map());

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown, max = 40) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "");

export function parseRank(raw: unknown): RankView | null {
  const d = raw as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return null;
  const nickname = str(d.nickname);
  const tier = str(d.tier);
  const mmr = num(d.mmr);
  if (!nickname || !tier || mmr === null) return null;
  const last = d.last as Record<string, unknown> | null;
  const gain = num(last?.gain);
  const recent = Array.isArray(d.recent) ? d.recent.filter((v): v is number => Number.isInteger(v) && v >= 1 && v < 100).slice(0, 10) : [];
  return {
    nickname,
    tier,
    mmr,
    place: str(d.place),
    serverRank: num(d.serverRank),
    serverCode: num(d.serverCode),
    last: gain === null ? null : { gain, at: num(last?.at) },
    recent,
    updatedAt: num(d.updatedAt) ?? 0,
  };
}

async function load(nickname: string): Promise<RankResult> {
  const url = botApiUrl();
  if (!url) return { ok: false, status: 503 };
  try {
    const r = await fetch(`${url}/api/tier?n=${encodeURIComponent(nickname)}`, {
      headers: { "x-bot-token": process.env.LABS_BOT_TOKEN ?? "" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (r.status === 404 || r.status === 400) {
      await r.body?.cancel();
      return { ok: false, status: 404 };
    }
    if (r.status === 429) {
      await r.body?.cancel();
      return { ok: false, status: 429 };
    }
    if (!r.ok) {
      await r.body?.cancel();
      return { ok: false, status: 503 };
    }
    const data = parseRank(await r.json());
    return data ? { ok: true, data } : { ok: false, status: 503 };
  } catch {
    return { ok: false, status: 503 };
  }
}

const fresh = (e: Entry, t: number) => t - e.at < (e.result.ok ? TTL : e.result.status === 404 ? MISS_TTL : FAIL_TTL);

/** 몽실봇이 읽은 티어와 RP. 닉네임마다 60초 동안 같은 값, 실패하면 마지막 값을 그대로 씀 */
export async function rankOf(nickname: string): Promise<RankResult> {
  const key = nickname.toLowerCase();
  const t = Date.now();
  const hit = cache.get(key);
  if (hit && fresh(hit, t)) return hit.result;
  let p = pending.get(key);
  if (!p) {
    p = load(nickname).finally(() => pending.delete(key));
    pending.set(key, p);
  }
  const result = await p;
  // 방송 중 봇이 잠깐 응답하지 않아도 카드가 사라지지 않게 성공한 값을 유지
  if (!result.ok && result.status !== 404 && hit?.result.ok) {
    cache.set(key, { at: t - TTL + FAIL_TTL, result: hit.result });
    return hit.result;
  }
  cache.set(key, { at: Date.now(), result });
  if (cache.size > MAX_ENTRIES) for (const [k, e] of cache) if (!fresh(e, Date.now())) cache.delete(k);
  return result;
}

/** 처음 보는 닉네임인지. 남용 방지 한도를 셀 때 씀 */
export const cachedRank = (nickname: string) => cache.has(nickname.toLowerCase());
