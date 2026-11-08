import "server-only";
import type { LiveFrame } from "@/er/lib/live";
import { normalizeCode } from "./tournament";

// 경기 중 값은 메모리에만 둠. 재배포하면 사라지고, 읽기 탭이 다음 값을 보내면 다시 채워짐
const KEEP = 6 * 3_600_000;
const g = globalThis as unknown as { __live?: Map<string, LiveFrame> };
const frames = (g.__live ??= new Map());

const keyOf = (code: string, group: number) => `${normalizeCode(code)}:${group}`;

export function setLive(code: string, group: number, frame: LiveFrame) {
  frames.set(keyOf(code, group), frame);
  if (frames.size > 200) for (const [k, f] of frames) if (Date.now() - f.at > KEEP) frames.delete(k);
}

export function getLive(code: string, group: number): LiveFrame | null {
  const f = frames.get(keyOf(code, group));
  if (!f) return null;
  if (Date.now() - f.at > KEEP) {
    frames.delete(keyOf(code, group));
    return null;
  }
  return f;
}
