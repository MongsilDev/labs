import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { currentUser, type User } from "@/er/server/auth";

export type L10nVersion = { id: string; keys: number; fetched_at: string; from: string | null; added?: number; removed?: number; changed?: number };
export type L10nDiff = { id: string; from: string; added: Record<string, string>; removed: Record<string, string>; changed: Record<string, [string, string]> };

// 호스트의 l10n 감시(~/docker/_ops/l10n/watch.py)가 SSD 원본에서 화면용 파일만 복사해 둠
const dir = () => join(process.env.DATA_DIR ?? "data", "l10n", "Korean");
const ID = /^\d{14}(?:\.\d+)?$/;

// 스트리밍이 시작되기 전에 불러야 404 상태 코드가 나감. KEL 비공개 화면과 같은 소유자 계정만 통과
export async function l10nGate(): Promise<User> {
  const user = await currentUser();
  const owner = process.env.KEL_OWNER_ID;
  if (!owner || !user || user.id !== owner) notFound();
  return user;
}

async function json<T>(...parts: string[]): Promise<T | null> {
  try {
    return JSON.parse(await readFile(join(dir(), ...parts), "utf8"));
  } catch {
    return null;
  }
}

export async function l10nIndex() {
  const [versions, state] = await Promise.all([json<L10nVersion[]>("index.json"), json<{ checked_at?: string }>("state.json")]);
  return { versions: versions ?? [], checked: state?.checked_at ?? null };
}

export const l10nDiff = (id: string) => (ID.test(id) ? json<L10nDiff>("diffs", `${id}.json`) : Promise.resolve(null));

// 판 ID는 l10Path 파일 이름의 KST 시각 14자리. 같은 경로의 파일이 바뀌면 .1, .2가 붙음
export function versionLabel(id: string): string {
  const [d, n] = id.split(".");
  const t = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
  return n ? `${t} (${Number(n) + 1})` : t;
}

// 파일 안의 줄바꿈은 \n 두 글자로 적혀 있음
export const unescape = (v: string) => v.replaceAll("\\n", "\n");
