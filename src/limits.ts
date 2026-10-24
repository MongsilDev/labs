import "server-only";
import { headers } from "next/headers";
import { limitKey } from "@/ip";

type Bucket = { count: number; reset: number };
// ER과 Tarkov가 같은 기록을 쓰므로 키 접두어가 겹치지 않게 함
const g = globalThis as unknown as { __limits?: Map<string, Bucket> };
const buckets = (g.__limits ??= new Map());

export const ipOf = (h: Headers) => limitKey(h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || "local");

export async function clientIp(): Promise<string> {
  return ipOf(await headers());
}

export function allow(key: string, max: number, windowMs: number): boolean {
  const t = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= t) {
    buckets.set(key, { count: 1, reset: t + windowMs });
    if (buckets.size > 50_000) sweep(t);
    return true;
  }
  if (b.count >= max) return false;
  b.count++;
  return true;
}

export function sweep(t = Date.now()) {
  for (const [k, v] of buckets) if (v.reset <= t) buckets.delete(k);
}

// 없는 대회 코드를 반복해 여는 IP는 있는 코드 요청도 잠시 거부. API는 429로 응답
export function miss(ip: string) {
  allow(`miss:${ip}`, 1_000_000, 10 * 60_000);
}

export function blocked(ip: string): boolean {
  const b = buckets.get(`miss:${ip}`);
  return Boolean(b && b.reset > Date.now() && b.count >= 30);
}
