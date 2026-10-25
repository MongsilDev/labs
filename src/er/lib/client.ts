import type { CreateInput, InviteRow, MemberRow, Op, OpResult, TournamentView } from "./view";

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  } catch {
    throw new Error("서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요.");
  }
  if (res.status === 204) return null as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as { error?: string }).error || "처리하지 못했습니다."), { status: res.status });
  return data as T;
}

export const api = {
  view: (code: string, since?: number) => call<TournamentView | null>(`/api/t/${code}${since ? `?since=${since}` : ""}`),
  op: (code: string, op: Op) => call<OpResult>(`/api/t/${code}`, { method: "POST", body: JSON.stringify(op) }),
  create: (input: CreateInput) => call<{ code: string }>("/api/t", { method: "POST", body: JSON.stringify(input) }),
  remove: (code: string, confirm: string) => call<{ ok: true }>(`/api/t/${code}`, { method: "DELETE", body: JSON.stringify({ confirm }) }),
  members: (code: string) => call<{ members: MemberRow[]; invites: InviteRow[] }>(`/api/t/${code}/members`),
  member: (code: string, body: { action: string; token?: string; user?: string; uses?: number }) =>
    call<{ ok?: true; token?: string }>(`/api/t/${code}/members`, { method: "POST", body: JSON.stringify(body) }),
  accept: (token: string) => call<{ code: string; already: boolean }>(`/api/i/${token}`, { method: "POST" }),
};

const RECENT = "er-recent";
export type Recent = { code: string; name: string; at: number };

export function rememberRecent(code: string, name: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(RECENT) || "[]") as Recent[]).filter((r) => r.code !== code);
    list.unshift({ code, name, at: Date.now() });
    localStorage.setItem(RECENT, JSON.stringify(list.slice(0, 10)));
  } catch {}
}

export function readRecent(): Recent[] {
  try {
    return (JSON.parse(localStorage.getItem(RECENT) || "[]") as Recent[]).filter((r) => Date.now() - r.at < 24 * 3_600_000);
  } catch {
    return [];
  }
}
