import type { PenaltyInput, WeatherInput } from "./engine";
import type { Player } from "./parse";
import type { Mode, Preset, Rules } from "./rules";

export type Role = "owner" | "operator" | null;

export type RoundRow = {
  id: number;
  roundNo: number;
  source: "csv" | "manual";
  gameId: number | null;
  fileName: string | null;
  players: Player[];
  discord?: boolean;
};

export type GroupView = {
  idx: number;
  label: string;
  rounds: RoundRow[];
  penalties: PenaltyInput[];
  weather: WeatherInput[];
  aliases: Record<string, string>;
  overrides: Record<string, boolean>;
};

export type LogRow = { id: number; userName: string; text: string; at: number };

export type Me = { id: string; name: string; avatar: string | null };

export type TournamentView = {
  code: string;
  name: string;
  mode: Mode;
  rules: Rules;
  plannedRounds: number;
  groupCount: number;
  version: number;
  updatedAt: number;
  expiresAt: number;
  role: Role;
  example?: boolean;
  source?: { name: string; url: string };
  groups: GroupView[];
  logs: LogRow[] | null;
  /** 개최자와 운영자에게만 보내는 조별 디스코드 연결 */
  discord?: { group: number; channel: string }[];
  /** 스크림 대회의 조별 키. 개최자와 운영자는 모든 조, 키로 연 사람은 그 조 하나 */
  keys?: string[];
};

/** 키로 연 사람이 조회 요청에 함께 보낼 키 */
export const firstPath = (view: Pick<TournamentView, "code" | "keys">) => `/er/t/${view.code}/${view.keys?.[0] ?? "a"}`;

export const viewKey = (view: Pick<TournamentView, "role" | "keys">) => (view.role ? undefined : view.keys?.[0]);

/** 주소의 조 자리는 일반 대회면 글자, 스크림 대회면 조별 키. 없는 조면 -1 */
export function groupIndex(view: Pick<TournamentView, "keys" | "groupCount">, segment: string): number {
  if (view.keys) return view.keys.indexOf(segment);
  const idx = segment.length === 1 ? segment.toLowerCase().charCodeAt(0) - 97 : -1;
  return idx >= 0 && idx < view.groupCount ? idx : -1;
}

export type CreateInput = {
  name: string;
  mode: Mode;
  preset: Preset;
  plannedRounds: number;
  groupCount: number;
  rules?: Partial<Rules>;
};

export type Op =
  | { op: "add_csv"; group: number; files: { name: string; text: string }[]; round?: number }
  | { op: "add_manual"; group: number; round: number; teams: { team: string; placement: number; killScore: number }[] }
  | { op: "delete_round"; id: number }
  | { op: "restore_round"; id: number; replace?: boolean }
  | { op: "set_weather"; group: number; round: number; main?: string | null; sub?: string | null }
  | { op: "add_penalty"; group: number; team: string; round: number; kind: "death" | "rule"; count?: number; points?: number; reason?: string }
  | { op: "delete_penalty"; id: number }
  | { op: "restore_penalty"; id: number }
  | { op: "rename_team"; group: number; from: string; to: string; also?: string[] }
  | { op: "set_checkpoint"; group: number; round: number; team: string; state: boolean | null }
  | { op: "update_settings"; name?: string; mode?: Mode; preset?: Preset; rules?: Partial<Rules>; plannedRounds?: number; groupCount?: number }
  | { op: "unlink_discord"; group: number }
  | { op: "link_discord"; group: number; channelId: string };

export type OpResult = { ok: boolean; version: number; notices: string[]; errors: string[]; undo?: { op: Op; label: string } };

export type MemberRow = { id: string; name: string; avatar: string | null; role: "owner" | "operator"; joinedAt: number };
export type UploadKeyRow = { group: number; createdBy: string; createdAt: number; lastUsedAt: number | null };
export type RelayStatus = "duplicate" | "ended" | "invalid" | "added";
export type DiscordLinkRow = {
  group: number;
  channelId: string;
  guild: string;
  channel: string;
  last: { at: number; status: RelayStatus; round: number | null; user: string } | null;
};
export type DiscordGuild = { id: string; name: string; channels: { id: string; name: string }[] };
export type InviteRow = { token: string; createdAt: number; usesLeft: number };
export type MyTournament = {
  code: string;
  name: string;
  role: "owner" | "operator";
  expiresAt: number;
  mode: Mode;
  groupCount: number;
  played: number;
};

export const RETENTION_MS = 24 * 60 * 60 * 1000;
