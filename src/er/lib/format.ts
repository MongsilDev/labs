import characters from "@/er/data/characters.json";
import type { RoundSummary } from "./engine";

const KO = characters as Record<string, string>;

export const fmt = (v: number) => (Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toString());
export const fmt1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
// 순위표 점수 표기. 소수 첫째 자리에서 반올림해 정수면 소수점 없이 씀
export const num = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const duration = (seconds: number) => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, "0")}초`;
};

export function characterName(english: string): string {
  return KO[english] ?? KO[english.replace(/\s+/g, "")] ?? english;
}

export function remaining(expiresAt: number, at = Date.now()): string {
  const ms = expiresAt - at;
  if (ms <= 0) return "곧 삭제";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 1) return `${h}시간 뒤 삭제`;
  return `${Math.max(1, Math.ceil(ms / 60_000))}분 뒤 삭제`;
}

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 45) return "방금";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(at);
}

export const dateKo = (at: number) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeZone: "Asia/Seoul" }).format(at);
export const timeKo = (at: number) =>
  new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(at);

export function rampColor(i: number, n: number): string {
  const p = n <= 1 ? 100 : Math.round((i / (n - 1)) * 100);
  return `color-mix(in srgb, var(--ramp-b) ${p}%, var(--ramp-a))`;
}

// src/app/er/globals.css의 --ramp-a, --ramp-b와 같은 값
const RAMP = { dark: ["#0f5c66", "#26f1f6"], light: ["#6fd6dd", "#0a5f66"] } as const;

// 흰 글자와 검은 글자 모두 대비 4.5 이상이 되는 경계가 상대 휘도 0.179
export function rampDarkText(i: number, n: number, theme: keyof typeof RAMP): boolean {
  const p = n <= 1 ? 1 : Math.round((i / (n - 1)) * 100) / 100;
  const [a, b] = RAMP[theme].map((h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
  const lin = (v: number) => (v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4);
  const lum = [0.2126, 0.7152, 0.0722].reduce((sum, w, k) => sum + w * lin(a[k] + (b[k] - a[k]) * p), 0);
  return lum > 0.179;
}

export const rampTextClass = (i: number, n: number) => [rampDarkText(i, n, "dark") && "dk", rampDarkText(i, n, "light") && "dl"].filter(Boolean).join(" ") || undefined;

export const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
export const byCharacter = (a: string, b: string) => byText(characterName(a), characterName(b));

export const replays = (rounds: RoundSummary[]) =>
  rounds.flatMap((r) => (r.source === "csv" && r.gameId !== null ? [{ roundNo: r.roundNo, gameId: r.gameId }] : []));

export const replayText = (list: { roundNo: number; gameId: number }[]) => list.map((r) => `${r.roundNo}R ${r.gameId}`).join("\n");
