import "server-only";
import { timingSafeEqual } from "node:crypto";
import { exampleView } from "@/er/lib/example";
import { groupResult } from "@/er/lib/engine";
import { characterName } from "@/er/lib/format";
import type { Mode, Tiebreak } from "@/er/lib/rules";
import type { Role, TournamentView } from "@/er/lib/view";
import { BASE_URL } from "./auth";
import { groupLabel } from "@/er/lib/rules";
import { linkedChannel, loadView, myTournaments, relayDiscord, tournamentVersion } from "./tournament";

export const EXAMPLE_CODE = "EXAMPLE";

export type BoardRow = {
  rank: number;
  delta: number;
  name: string;
  total: number;
  killScore: number;
  kills: number;
  penalty: number;
  checkpoint: boolean;
  fixed: number | null;
  tiedBy: string | null;
};

export type Board = {
  code: string;
  name: string;
  mode: Mode;
  tiebreak: Tiebreak;
  advance: number;
  plannedRounds: number;
  played: number;
  ended: boolean;
  groupCount: number;
  groups: string[];
  group: string;
  version: number;
  updatedAt: number;
  url: string;
  role: Role;
  /** 이 조에 연결된 디스코드 채널 */
  channelId: string | null;
  standings: BoardRow[];
  next: { roundNo: number; main: string; sub: string | null; bans: string[] } | null;
};

export type BotTournament = { code: string; name: string; role: "owner" | "operator"; played: number };

export function botAuthorized(header: string | null): boolean {
  const want = process.env.LABS_BOT_TOKEN;
  if (!want || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

const asUser = (id: string | null) => (id && /^\d{1,20}$/.test(id) ? { id, name: "", avatar: null } : null);

export function boardVersion(code: string): number | null {
  return code.toUpperCase() === EXAMPLE_CODE ? exampleView().version : tournamentVersion(code);
}

export function botBoard(code: string, group: string | null, userId: string | null): Board | "no-group" | null {
  const example = code.toUpperCase() === EXAMPLE_CODE;
  const view: TournamentView | null = example ? exampleView() : loadView(code, asUser(userId));
  if (!view) return null;
  const label = (group || "A").toUpperCase();
  const idx = view.groups.findIndex((g) => g.label === label);
  if (idx < 0) return "no-group";
  const res = groupResult(view, idx);
  return {
    code: view.code,
    name: view.name,
    mode: view.mode,
    tiebreak: view.rules.tiebreak,
    advance: view.rules.advance,
    plannedRounds: view.plannedRounds,
    played: res.played,
    ended: res.ended,
    groupCount: view.groupCount,
    groups: view.groups.map((g) => g.label),
    group: label,
    version: view.version,
    updatedAt: view.updatedAt,
    url: example ? `${BASE_URL}/er/example/${label.toLowerCase()}` : `${BASE_URL}/er/t/${view.code}/${label.toLowerCase()}`,
    role: example ? null : view.role,
    channelId: example ? null : linkedChannel(view.code, idx),
    standings: res.standings.map((s) => ({
      rank: s.rank,
      delta: s.delta,
      name: s.name,
      total: s.total,
      killScore: s.killScore,
      kills: s.kills,
      penalty: s.penalty,
      checkpoint: s.checkpoint,
      fixed: s.fixed,
      tiedBy: s.tiedBy,
    })),
    next: res.next && !res.ended ? { roundNo: res.next.roundNo, main: res.next.main, sub: res.next.sub, bans: res.next.bans.map(characterName) } : null,
  };
}

export function botTournaments(userId: string): BotTournament[] {
  const user = asUser(userId);
  if (!user) return [];
  return myTournaments(user)
    .slice(0, 100)
    .map((t) => ({ code: t.code, name: t.name, role: t.role, played: t.played }));
}

export type RelayReply =
  | { status: "unlinked" }
  | {
      status: "duplicate" | "ended" | "invalid" | "added";
      message: string;
      code: string;
      name: string;
      group: string;
      groupCount: number;
      url: string;
      round?: number;
      ranking?: { rank: number; team: string; score: number }[];
    };

// 디스코드 채널에 올라온 결과 파일을 연결된 조에 넣고, 넣은 라운드의 순위를 대회 화면과 같은 계산으로 돌려줌
export function botRelay(channelId: unknown, actor: unknown, actorName: unknown, fileName: unknown, data: unknown): RelayReply {
  const bytes = typeof data === "string" ? Buffer.from(data, "base64") : Buffer.alloc(0);
  const r = relayDiscord(channelId, actor, actorName, { name: typeof fileName === "string" ? fileName : "", bytes });
  if (r.status === "unlinked") return r;
  const label = groupLabel(r.group);
  const out = { status: r.status, message: r.message, code: r.code, name: r.name, group: label, groupCount: r.groupCount, url: `${BASE_URL}/er/t/${r.code}/${label.toLowerCase()}` };
  if (r.status !== "added" || r.round === null) return out;
  const round = r.round;
  const ranking = groupResult(loadView(r.code, null)!, r.group)
    .standings.flatMap((s) => {
      const x = s.rounds[round - 1];
      return x && x.placement !== null ? [{ rank: x.placement, team: s.name, score: x.score }] : [];
    })
    .sort((a, b) => a.rank - b.rank);
  return { ...out, round, ranking };
}
