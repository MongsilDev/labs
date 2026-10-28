import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { DAY, db, now } from "./db";

export type User = { id: string; name: string; avatar: string | null };

const SESSION_TTL = 7 * DAY;
export const BASE_URL = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const SECURE = BASE_URL.startsWith("https://");
export const SESSION_COOKIE = SECURE ? "__Host-er_session" : "er_session";
export const STATE_COOKIE = SECURE ? "__Host-er_state" : "er_state";
export const CLIENT_ID = process.env.DISCORD_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const API = "https://discord.com/api/v10";

export const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: SECURE,
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export const token = (bytes = 24) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function safeNext(value: string | null | undefined): string {
  if (!value || !/^\/(?:[A-Za-z0-9_\-/~%]*)(?:\?[A-Za-z0-9_\-=&.~%+*]*)?$/.test(value) || value.includes("//")) return "/er/score";
  return value;
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: `${BASE_URL}/auth/callback`,
    scope: "identify",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params}`;
}

export async function exchange(code: string): Promise<User | null> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${BASE_URL}/auth/callback`,
  });
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    console.warn(`[로그인] 토큰 교환 실패 ${res.status}`);
    return null;
  }
  const tokenData = (await res.json()) as { access_token: string };
  const me = await fetch(`${API}/users/@me`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!me.ok) {
    console.warn(`[로그인] 사용자 정보 조회 실패 ${me.status}`);
    return null;
  }
  const u = (await me.json()) as { id: string; username: string; global_name?: string | null; avatar?: string | null };
  return { id: u.id, name: u.global_name || u.username, avatar: u.avatar ?? null };
}

export function createSession(user: User): { id: string; maxAge: number } {
  const id = token(32);
  const t = now();
  const conn = db();
  conn
    .prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar, updated_at = excluded.updated_at")
    .run(user.id, user.name, user.avatar, t);
  conn.prepare("INSERT INTO sessions(hash, user_id, expires_at) VALUES (?, ?, ?)").run(hash(id), user.id, t + SESSION_TTL);
  return { id, maxAge: SESSION_TTL / 1000 };
}

// 로그아웃하면 그 계정의 모든 기기 세션을 지움. 만료된 세션으로는 그 세션만 지움
export function deleteSessions(id: string) {
  const h = hash(id);
  db().prepare("DELETE FROM sessions WHERE hash = ? OR user_id = (SELECT user_id FROM sessions WHERE hash = ? AND expires_at > ?)").run(h, h, Date.now());
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const sid = jar.get(SESSION_COOKIE)?.value;
  if (!sid) return null;
  const row = db()
    .prepare("SELECT u.id, u.name, u.avatar FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.hash = ? AND s.expires_at > ?")
    .get(hash(sid), now()) as User | undefined;
  return row ?? null;
}

export function avatarUrl(user: Pick<User, "id" | "avatar">, size = 64): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=${size}`;
}

export async function sameOrigin(): Promise<boolean> {
  const h = await headers();
  const origin = h.get("origin");
  if (!origin) return h.get("sec-fetch-site") === "same-origin";
  return origin === BASE_URL;
}
