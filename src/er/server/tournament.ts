import "server-only";
import { randomInt } from "node:crypto";
import type { PenaltyInput } from "@/er/lib/engine";
import { groupResult, normalize } from "@/er/lib/engine";
import { parseRoundCsv, type Player } from "@/er/lib/parse";
import { cleanName } from "@/er/lib/text";
import {
  LIMITS,
  MAIN_WEATHERS,
  MODE_LABEL,
  SUB_WEATHERS,
  clampRules,
  groupLabel,
  type Mode,
  type Preset,
  type Rules,
} from "@/er/lib/rules";
import {
  RETENTION_MS,
  type CreateInput,
  type GroupView,
  type InviteRow,
  type MemberRow,
  type MyTournament,
  type Op,
  type OpResult,
  type Role,
  type RoundRow,
  type TournamentView,
  type UploadKeyRow,
} from "@/er/lib/view";
import type { User } from "./auth";
import { hash, token } from "./auth";
import { db, now, tx } from "./db";

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const MODES: Mode[] = ["points", "checkpoint", "double"];
const PRESETS: Preset[] = ["masters", "custom"];

type TRow = {
  id: number;
  code: string;
  name: string;
  mode: Mode;
  rules: string;
  planned_rounds: number;
  group_count: number;
  created_by: string;
  updated_at: number;
  version: number;
};

export class OpError extends Error {}

function newCode(): string {
  for (let i = 0; i < 20; i++) {
    let c = "";
    for (let j = 0; j < 6; j++) c += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!db().prepare("SELECT 1 FROM tournaments WHERE code = ?").get(c)) return c;
  }
  throw new Error("대회 코드를 만들지 못했습니다.");
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

const clean = (s: unknown, max: number) =>
  typeof s === "string" ? s.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ").slice(0, max) : "";

const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : d;
  return Math.min(hi, Math.max(lo, n));
};

function find(code: string): TRow | undefined {
  return db().prepare("SELECT * FROM tournaments WHERE code = ?").get(normalizeCode(code)) as TRow | undefined;
}

function roleOf(t: TRow, user: User | null): Role {
  if (!user) return null;
  const m = db().prepare("SELECT role FROM members WHERE tournament_id = ? AND user_id = ?").get(t.id, user.id) as
    | { role: "owner" | "operator" }
    | undefined;
  return m?.role ?? null;
}

// 운영자가 아니면 없는 코드와 같은 오류를 내서 코드가 있는지 알 수 없게 함
function findRole(code: string, user: User): { t: TRow; role: "owner" | "operator" } {
  const t = find(code);
  const role = t ? roleOf(t, user) : null;
  if (!t || !role) throw new OpError("없는 대회이거나 이 대회의 운영자가 아닙니다.");
  return { t, role };
}

function rulesOf(t: TRow): Rules {
  const parsed = JSON.parse(t.rules) as Rules;
  return clampRules(parsed, parsed.preset);
}

function bump(t: TRow, user: User, text: string) {
  const conn = db();
  const at = now();
  conn.prepare("UPDATE tournaments SET version = version + 1, updated_at = ? WHERE id = ?").run(at, t.id);
  conn.prepare("INSERT INTO logs(tournament_id, user_name, text, created_at) VALUES (?, ?, ?, ?)").run(t.id, user.name, text, at);
}

function versionOf(id: number): number {
  return (db().prepare("SELECT version FROM tournaments WHERE id = ?").get(id) as { version: number }).version;
}

export function createTournament(user: User, input: CreateInput): string {
  const name = clean(input.name, LIMITS.nameLength);
  if (!name) throw new OpError("대회 이름을 입력해주세요.");
  const mode = MODES.includes(input.mode) ? input.mode : "points";
  const preset = PRESETS.includes(input.preset) ? input.preset : "masters";
  const rules = clampRules(input.rules, preset);
  const planned = int(input.plannedRounds, 1, LIMITS.rounds, mode === "points" ? 4 : LIMITS.rounds);
  const groups = int(input.groupCount, 1, LIMITS.groups, 1);
  const active = db().prepare("SELECT COUNT(*) AS n FROM members WHERE user_id = ? AND role = 'owner'").get(user.id) as { n: number };
  if (active.n >= 20) throw new OpError("진행 중인 대회는 20개까지 만들 수 있습니다. 끝난 대회를 지운 뒤 다시 만들어주세요.");
  return tx(() => {
    const code = newCode();
    const t = now();
    const r = db()
      .prepare("INSERT INTO tournaments(code, name, mode, rules, planned_rounds, group_count, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(code, name, mode, JSON.stringify(rules), planned, groups, user.id, t, t);
    const id = Number(r.lastInsertRowid);
    db().prepare("INSERT INTO members(tournament_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(id, user.id, t);
    db().prepare("INSERT INTO logs(tournament_id, user_name, text, created_at) VALUES (?, ?, ?, ?)").run(id, user.name, "대회 만들기", t);
    return code;
  });
}

export function tournamentVersion(code: string): number | null {
  return find(code)?.version ?? null;
}

export function loadView(code: string, user: User | null): TournamentView | null {
  const t = find(code);
  if (!t) return null;
  const conn = db();
  const role = roleOf(t, user);
  const groups: GroupView[] = Array.from({ length: t.group_count }, (_, idx) => ({
    idx,
    label: groupLabel(idx),
    rounds: [],
    penalties: [],
    weather: [],
    aliases: {},
    overrides: {},
  }));
  type RR = { id: number; group_idx: number; round_no: number; source: "csv" | "manual"; game_id: number | null; file_name: string | null; players: string };
  for (const r of conn.prepare("SELECT * FROM rounds WHERE tournament_id = ? AND deleted_at IS NULL ORDER BY round_no").all(t.id) as RR[]) {
    groups[r.group_idx]?.rounds.push({
      id: r.id,
      roundNo: r.round_no,
      source: r.source,
      gameId: r.game_id,
      fileName: r.file_name,
      players: JSON.parse(r.players) as Player[],
    });
  }
  type PR = { id: number; group_idx: number; team: string; round_no: number; kind: "death" | "rule"; count: number; points: number; reason: string };
  for (const p of conn.prepare("SELECT * FROM penalties WHERE tournament_id = ? AND deleted_at IS NULL ORDER BY id").all(t.id) as PR[]) {
    groups[p.group_idx]?.penalties.push({ id: p.id, team: p.team, roundNo: p.round_no, kind: p.kind, count: p.count, points: p.points, reason: p.reason });
  }
  type WR = { group_idx: number; round_no: number; main: string | null; sub: string | null };
  for (const w of conn.prepare("SELECT * FROM weather WHERE tournament_id = ?").all(t.id) as WR[]) {
    groups[w.group_idx]?.weather.push({ roundNo: w.round_no, main: w.main, sub: w.sub });
  }
  type AR = { group_idx: number; from_name: string; to_name: string };
  for (const a of conn.prepare("SELECT * FROM aliases WHERE tournament_id = ?").all(t.id) as AR[]) {
    if (groups[a.group_idx]) groups[a.group_idx].aliases[a.from_name] = a.to_name;
  }
  type OR = { group_idx: number; round_no: number; team: string; state: number };
  for (const o of conn.prepare("SELECT * FROM overrides WHERE tournament_id = ?").all(t.id) as OR[]) {
    if (groups[o.group_idx]) groups[o.group_idx].overrides[`${o.round_no}:${o.team}`] = o.state === 1;
  }
  type LR = { id: number; user_name: string; text: string; created_at: number };
  const logs = role
    ? (conn.prepare("SELECT * FROM logs WHERE tournament_id = ? ORDER BY id DESC LIMIT 50").all(t.id) as LR[]).map((l) => ({
        id: l.id,
        userName: l.user_name,
        text: l.text,
        at: l.created_at,
      }))
    : null;
  return {
    code: t.code,
    name: t.name,
    mode: t.mode,
    rules: rulesOf(t),
    plannedRounds: t.planned_rounds,
    groupCount: t.group_count,
    version: t.version,
    updatedAt: t.updated_at,
    expiresAt: t.updated_at + RETENTION_MS,
    role,
    groups,
    logs,
  };
}

function assertGroup(t: TRow, group: unknown): number {
  const g = typeof group === "number" ? group : -1;
  if (!Number.isInteger(g) || g < 0 || g >= t.group_count) throw new OpError("없는 조입니다.");
  return g;
}

function assertRound(t: TRow, round: unknown): number {
  const r = typeof round === "number" ? round : 0;
  if (!Number.isInteger(r) || r < 1 || r > t.planned_rounds) throw new OpError(`라운드는 1부터 ${t.planned_rounds}까지입니다.`);
  return r;
}

const prefix = (t: TRow, g: number) => (t.group_count > 1 ? `${groupLabel(g)}조 ` : "");

// 조마다 살아 있는 감점과 체크포인트 수동 판정의 상한. 판정은 12라운드 24팀이 모두 받아도 288건
const GROUP_ROWS = 300;
const livePenalties = (t: TRow, g: number) =>
  (db().prepare("SELECT COUNT(*) AS n FROM penalties WHERE tournament_id = ? AND group_idx = ? AND deleted_at IS NULL").get(t.id, g) as { n: number }).n;

// 되돌리기 알림은 세 개까지 떠 있으므로, 같은 슬롯에서 지운 기록은 최근 세 개만 두고 나머지는 정리 시각을 기다리지 않고 지움
function dropOlderDeleted(t: TRow, g: number, round: number) {
  db()
    .prepare(
      `DELETE FROM rounds WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND deleted_at IS NOT NULL AND id NOT IN
       (SELECT id FROM rounds WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC LIMIT 3)`,
    )
    .run(t.id, g, round, t.id, g, round);
}

export function applyOp(code: string, user: User, op: Op): OpResult {
  const { t, role } = findRole(code, user);
  return tx(() => runOp(t, role, user, op));
}

// 트랜잭션은 부르는 쪽이 엶. via는 변경 기록 끝에 붙는 표시
function runOp(t: TRow, role: "owner" | "operator", user: User, op: Op, via = ""): OpResult {
  const notices: string[] = [];
  const errors: string[] = [];
  let undo: OpResult["undo"];
  const conn = db();

  switch (op.op) {
    case "add_csv": {
      const g = assertGroup(t, op.group);
      const files = Array.isArray(op.files) ? op.files.slice(0, 24) : [];
      if (files.length === 0) throw new OpError("CSV 파일을 골라주세요.");
      const parsed: { name: string; gameId: number; players: Player[] }[] = [];
      for (const f of files) {
        const name = clean(f?.name, 120) || "이름 없는 파일";
        if (typeof f?.text !== "string" || f.text.length > LIMITS.csvBytes) {
          errors.push(`${name}: 200KB가 넘는 파일은 올릴 수 없습니다.`);
          continue;
        }
        const r = parseRoundCsv(f.text);
        if (!r.ok) {
          errors.push(`${name}: ${r.error}`);
          continue;
        }
        if (parsed.some((p) => p.gameId === r.round.gameId)) {
          errors.push(`${name}: 함께 올린 파일 중에 같은 경기의 CSV가 있습니다.`);
          continue;
        }
        const dup = conn
          .prepare("SELECT group_idx, round_no FROM rounds WHERE tournament_id = ? AND game_id = ? AND deleted_at IS NULL")
          .get(t.id, r.round.gameId) as { group_idx: number; round_no: number } | undefined;
        if (dup) {
          errors.push(`${name}: 이미 ${prefix(t, dup.group_idx)}${dup.round_no}라운드에 올린 경기입니다.`);
          continue;
        }
        parsed.push({ name, gameId: r.round.gameId, players: r.round.players });
      }
      parsed.sort((a, b) => a.gameId - b.gameId);
      const used = new Set(
        (conn.prepare("SELECT round_no FROM rounds WHERE tournament_id = ? AND group_idx = ? AND deleted_at IS NULL").all(t.id, g) as { round_no: number }[]).map(
          (r) => r.round_no,
        ),
      );
      const target = op.round !== undefined && parsed.length === 1 ? assertRound(t, op.round) : null;
      for (const p of parsed) {
        let slot = target;
        if (slot !== null && used.has(slot)) {
          const old = conn
            .prepare("SELECT id FROM rounds WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND deleted_at IS NULL")
            .get(t.id, g, slot) as { id: number };
          conn.prepare("UPDATE rounds SET deleted_at = ? WHERE id = ?").run(now(), old.id);
          dropOlderDeleted(t, g, slot);
          undo = { op: { op: "restore_round", id: old.id, replace: true }, label: `${slot}라운드 이전 기록 되살리기` };
        }
        if (slot === null) {
          for (let n = 1; n <= t.planned_rounds; n++) {
            if (!used.has(n)) {
              slot = n;
              break;
            }
          }
        }
        if (slot === null) {
          errors.push(`${p.name}: 모든 라운드에 기록이 있습니다. 라운드 수를 늘리거나 기존 라운드를 지워주세요.`);
          continue;
        }
        used.add(slot);
        conn
          .prepare("INSERT INTO rounds(tournament_id, group_idx, round_no, source, game_id, file_name, players, created_at) VALUES (?, ?, ?, 'csv', ?, ?, ?, ?)")
          .run(t.id, g, slot, p.gameId, p.name, JSON.stringify(p.players), now());
        const teams = new Set(p.players.map((x) => normalize(x.team))).size;
        notices.push(`${prefix(t, g)}${slot}라운드에 ${teams}팀 기록을 추가했습니다.`);
        bump(t, user, `${prefix(t, g)}${slot}라운드 CSV ${target !== null ? "교체" : "추가"}${via}`);
      }
      break;
    }
    case "add_manual": {
      const g = assertGroup(t, op.group);
      const round = assertRound(t, op.round);
      const rows = Array.isArray(op.teams) ? op.teams.slice(0, LIMITS.teamsPerGroup) : [];
      const teams: { team: string; placement: number; killScore: number }[] = [];
      for (const x of rows) {
        const team = cleanName(x?.team);
        if (!team) continue;
        const placement = x?.placement;
        const killScore = x?.killScore ?? 0;
        if (typeof placement !== "number" || !Number.isInteger(placement) || placement < 1 || placement > LIMITS.teamsPerGroup) {
          throw new OpError(`${team}: 순위는 1부터 ${LIMITS.teamsPerGroup}까지의 정수로 입력해주세요.`);
        }
        if (typeof killScore !== "number" || !Number.isFinite(killScore) || killScore < 0 || killScore > 300) {
          throw new OpError(`${team}: 킬 점수는 0부터 300까지 입력해주세요.`);
        }
        teams.push({ team, placement, killScore });
      }
      if (teams.length === 0) throw new OpError("팀과 순위를 입력해주세요.");
      if (new Set(teams.map((x) => x.placement)).size !== teams.length) throw new OpError("두 팀에 같은 순위를 입력했습니다. 순위를 다시 확인해주세요.");
      if (new Set(teams.map((x) => normalize(x.team))).size !== teams.length) throw new OpError("같은 팀 이름이 두 번 있습니다. 한 줄을 지우거나 팀 이름을 고쳐주세요.");
      const old = conn
        .prepare("SELECT id FROM rounds WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND deleted_at IS NULL")
        .get(t.id, g, round) as { id: number } | undefined;
      if (old) {
        conn.prepare("UPDATE rounds SET deleted_at = ? WHERE id = ?").run(now(), old.id);
        dropOlderDeleted(t, g, round);
        undo = { op: { op: "restore_round", id: old.id, replace: true }, label: `${round}라운드 이전 기록 되살리기` };
      }
      const players: Player[] = teams.map((x) => ({
        nickname: "",
        character: "",
        team: x.team,
        placement: x.placement,
        totalScore: 0,
        killScore: Math.max(0, Math.round(x.killScore * 2) / 2),
        kills: 0,
        teamKills: 0,
        hunting: 0,
        level: 0,
      }));
      conn
        .prepare("INSERT INTO rounds(tournament_id, group_idx, round_no, source, game_id, file_name, players, created_at) VALUES (?, ?, ?, 'manual', NULL, NULL, ?, ?)")
        .run(t.id, g, round, JSON.stringify(players), now());
      notices.push(`${prefix(t, g)}${round}라운드에 ${teams.length}팀 기록을 직접 입력했습니다.`);
      bump(t, user, `${prefix(t, g)}${round}라운드 직접 입력`);
      break;
    }
    case "delete_round":
    case "restore_round": {
      const r = (Number.isSafeInteger(op.id) ? conn.prepare("SELECT * FROM rounds WHERE id = ? AND tournament_id = ?").get(op.id, t.id) : undefined) as
        | { id: number; group_idx: number; round_no: number; game_id: number | null; deleted_at: number | null }
        | undefined;
      if (!r) throw new OpError("없는 라운드입니다.");
      if (op.op === "delete_round") {
        if (r.deleted_at) break;
        conn.prepare("UPDATE rounds SET deleted_at = ? WHERE id = ?").run(now(), r.id);
        dropOlderDeleted(t, r.group_idx, r.round_no);
        undo = { op: { op: "restore_round", id: r.id }, label: "되돌리기" };
        bump(t, user, `${prefix(t, r.group_idx)}${r.round_no}라운드 삭제`);
      } else {
        if (!r.deleted_at) break;
        if (r.round_no > t.planned_rounds || r.group_idx >= t.group_count) {
          throw new OpError("지금 대회 설정의 라운드 수나 조 수를 벗어난 기록이라 되살릴 수 없습니다.");
        }
        const taken = conn
          .prepare("SELECT id FROM rounds WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND deleted_at IS NULL")
          .get(t.id, r.group_idx, r.round_no) as { id: number } | undefined;
        if (taken && !op.replace) throw new OpError(`${r.round_no}라운드에 다른 기록이 있어 되살릴 수 없습니다. 지금 기록을 먼저 지워주세요.`);
        if (taken) conn.prepare("UPDATE rounds SET deleted_at = ? WHERE id = ?").run(now(), taken.id);
        if (r.game_id !== null && conn.prepare("SELECT 1 FROM rounds WHERE tournament_id = ? AND game_id = ? AND deleted_at IS NULL").get(t.id, r.game_id)) {
          throw new OpError("같은 경기가 다른 라운드에 있어 되살릴 수 없습니다.");
        }
        conn.prepare("UPDATE rounds SET deleted_at = NULL WHERE id = ?").run(r.id);
        if (taken) dropOlderDeleted(t, r.group_idx, r.round_no);
        bump(t, user, `${prefix(t, r.group_idx)}${r.round_no}라운드 되살림`);
      }
      break;
    }
    case "set_weather": {
      const g = assertGroup(t, op.group);
      const round = assertRound(t, op.round);
      const cur = conn.prepare("SELECT main, sub FROM weather WHERE tournament_id = ? AND group_idx = ? AND round_no = ?").get(t.id, g, round) as
        | { main: string | null; sub: string | null }
        | undefined;
      const main = op.main === undefined ? (cur?.main ?? null) : op.main;
      const sub = op.sub === undefined ? (cur?.sub ?? null) : op.sub;
      if (main !== null && !(MAIN_WEATHERS as readonly string[]).includes(main)) throw new OpError("없는 메인 날씨입니다.");
      if (sub !== null && !(SUB_WEATHERS as readonly string[]).includes(sub)) throw new OpError("없는 서브 날씨입니다.");
      conn
        .prepare("INSERT INTO weather(tournament_id, group_idx, round_no, main, sub) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET main = excluded.main, sub = excluded.sub")
        .run(t.id, g, round, main, sub);
      const parts = [op.main !== undefined ? `메인 ${main ?? "기본값"}` : null, op.sub !== undefined ? `서브 ${sub ?? "없음"}` : null].filter(Boolean);
      bump(t, user, `${prefix(t, g)}${round}라운드 날씨: ${parts.join(", ")}`);
      break;
    }
    case "add_penalty": {
      const g = assertGroup(t, op.group);
      const round = int(op.round, 0, t.planned_rounds, 0);
      const team = cleanName(op.team, 60);
      if (!team) throw new OpError("팀을 골라주세요.");
      if (livePenalties(t, g) >= GROUP_ROWS) throw new OpError(`한 조에 감점은 ${GROUP_ROWS}건까지 추가할 수 있습니다.`);
      const kind = op.kind === "death" ? "death" : "rule";
      const count = kind === "death" ? int(op.count, 1, 30, 1) : 1;
      const points = kind === "death" ? count : Math.round(Math.min(100, Math.max(0.5, Number(op.points) || 0)) * 2) / 2;
      if (kind === "rule" && !(Number(op.points) > 0)) throw new OpError("감점할 점수를 입력해주세요.");
      const reason = kind === "death" ? "처치자 불명 사망" : clean(op.reason, 40) || "규정 위반";
      conn
        .prepare("INSERT INTO penalties(tournament_id, group_idx, team, round_no, kind, count, points, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(t.id, g, team, round, kind, count, points, reason, now());
      bump(t, user, `감점 추가: ${prefix(t, g)}${team} ${points}점, ${reason}`);
      break;
    }
    case "delete_penalty":
    case "restore_penalty": {
      const p = (Number.isSafeInteger(op.id) ? conn.prepare("SELECT * FROM penalties WHERE id = ? AND tournament_id = ?").get(op.id, t.id) : undefined) as
        | { id: number; group_idx: number; round_no: number; team: string; points: number; deleted_at: number | null }
        | undefined;
      if (!p) throw new OpError("없는 감점입니다.");
      if (op.op === "delete_penalty") {
        if (p.deleted_at) break;
        conn.prepare("UPDATE penalties SET deleted_at = ? WHERE id = ?").run(now(), p.id);
        undo = { op: { op: "restore_penalty", id: p.id }, label: "되돌리기" };
        bump(t, user, `감점 삭제: ${prefix(t, p.group_idx)}${p.team} ${p.points}점`);
      } else {
        if (!p.deleted_at) break;
        if (p.round_no > t.planned_rounds || p.group_idx >= t.group_count) throw new OpError("지금 대회 설정의 라운드 수나 조 수를 벗어난 감점이라 되살릴 수 없습니다.");
        if (livePenalties(t, p.group_idx) >= GROUP_ROWS) throw new OpError(`한 조에 감점은 ${GROUP_ROWS}건까지 둘 수 있습니다. 다른 감점을 지운 뒤 되살려주세요.`);
        conn.prepare("UPDATE penalties SET deleted_at = NULL WHERE id = ?").run(p.id);
        bump(t, user, `감점 되살림: ${prefix(t, p.group_idx)}${p.team} ${p.points}점`);
      }
      break;
    }
    case "rename_team": {
      const g = assertGroup(t, op.group);
      const to = cleanName(op.to, 40);
      const froms = [...new Set([op.from, ...(Array.isArray(op.also) ? op.also.slice(0, LIMITS.rounds) : [])].map((x) => cleanName(x, 60)).filter(Boolean))];
      if (froms.length === 0) throw new OpError("바꿀 팀을 골라주세요.");
      const shown = froms[0];
      const map = new Map(
        (conn.prepare("SELECT from_name, to_name FROM aliases WHERE tournament_id = ? AND group_idx = ?").all(t.id, g) as { from_name: string; to_name: string }[]).map(
          (a) => [normalize(a.from_name), a.to_name],
        ),
      );
      if (!to) {
        for (const from of froms) conn.prepare("DELETE FROM aliases WHERE tournament_id = ? AND group_idx = ? AND from_name = ?").run(t.id, g, from);
        bump(t, user, `팀 이름 되돌림: ${prefix(t, g)}${shown}`);
        break;
      }
      const targets = froms.filter((f) => normalize(f) !== normalize(to));
      if (targets.length === 0) break;
      if (targets.filter((f) => !map.has(normalize(f))).length + map.size > 100) throw new OpError("한 조에 팀 이름 변경은 100건까지 할 수 있습니다.");
      for (const from of targets) map.set(normalize(from), to);
      for (const from of targets) {
        let cur = to;
        for (let i = 0; i < 20; i++) {
          const next = map.get(normalize(cur));
          if (!next) break;
          if (normalize(next) === normalize(from) || normalize(cur) === normalize(from)) {
            throw new OpError("두 팀 이름이 서로를 가리키게 되어 바꿀 수 없습니다. 기존 변경을 먼저 되돌려주세요.");
          }
          cur = next;
        }
      }
      for (const from of targets) {
        conn
          .prepare("INSERT INTO aliases(tournament_id, group_idx, from_name, to_name) VALUES (?, ?, ?, ?) ON CONFLICT DO UPDATE SET to_name = excluded.to_name")
          .run(t.id, g, from, to);
      }
      bump(t, user, `팀 이름: ${prefix(t, g)}${shown} 대신 ${to}`);
      break;
    }
    case "set_checkpoint": {
      const g = assertGroup(t, op.group);
      const round = assertRound(t, op.round);
      const team = cleanName(op.team, 60);
      if (!team) throw new OpError("팀을 골라주세요.");
      const key = normalize(team);
      if (op.state === null) {
        conn.prepare("DELETE FROM overrides WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND team = ?").run(t.id, g, round, key);
        bump(t, user, `체크포인트 자동 판정: ${prefix(t, g)}${team}`);
      } else {
        const exists = conn.prepare("SELECT 1 FROM overrides WHERE tournament_id = ? AND group_idx = ? AND round_no = ? AND team = ?").get(t.id, g, round, key);
        const n = (conn.prepare("SELECT COUNT(*) AS n FROM overrides WHERE tournament_id = ? AND group_idx = ?").get(t.id, g) as { n: number }).n;
        if (!exists && n >= GROUP_ROWS) throw new OpError(`한 조에 체크포인트 수동 판정은 ${GROUP_ROWS}건까지 할 수 있습니다.`);
        conn
          .prepare("INSERT INTO overrides(tournament_id, group_idx, round_no, team, state) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO UPDATE SET state = excluded.state")
          .run(t.id, g, round, key, op.state ? 1 : 0);
        bump(t, user, `체크포인트 ${op.state ? "부여" : "해제"}: ${prefix(t, g)}${round}라운드 ${team}`);
      }
      break;
    }
    case "update_settings": {
      if (role !== "owner") throw new OpError("대회 설정은 개최자만 바꿀 수 있습니다.");
      const changes: string[] = [];
      const name = op.name === undefined ? t.name : clean(op.name, LIMITS.nameLength);
      if (!name) throw new OpError("대회 이름을 입력해주세요.");
      if (name !== t.name) changes.push(`이름 ${name}`);
      const mode = op.mode && MODES.includes(op.mode) ? op.mode : t.mode;
      if (mode !== t.mode) changes.push(`진행 방식 ${MODE_LABEL[mode]}`);
      const current = rulesOf(t);
      const preset = op.preset && PRESETS.includes(op.preset) ? op.preset : current.preset;
      const rules = op.rules || preset !== current.preset ? clampRules({ ...current, ...(op.preset && !op.rules ? clampRules(undefined, preset) : op.rules) }, preset) : current;
      if (JSON.stringify(rules) !== JSON.stringify(current)) changes.push("규칙");
      const planned = op.plannedRounds === undefined ? t.planned_rounds : int(op.plannedRounds, 1, LIMITS.rounds, t.planned_rounds);
      const maxRound = (conn.prepare("SELECT MAX(round_no) AS m FROM rounds WHERE tournament_id = ? AND deleted_at IS NULL").get(t.id) as { m: number | null }).m ?? 0;
      if (planned < maxRound) throw new OpError(`${maxRound}라운드까지 기록이 있어 라운드 수를 그보다 줄일 수 없습니다.`);
      if (planned !== t.planned_rounds) changes.push(`라운드 수 ${planned}`);
      const groups = op.groupCount === undefined ? t.group_count : int(op.groupCount, 1, LIMITS.groups, t.group_count);
      if (groups < t.group_count) {
        const used = conn
          .prepare(
            "SELECT MAX(g) AS m FROM (SELECT group_idx AS g FROM rounds WHERE tournament_id = ? AND deleted_at IS NULL UNION ALL SELECT group_idx FROM penalties WHERE tournament_id = ? AND deleted_at IS NULL)",
          )
          .get(t.id, t.id) as { m: number | null };
        if (used.m !== null && used.m >= groups) throw new OpError(`${groupLabel(used.m)}조에 기록이 있어 조 수를 줄일 수 없습니다.`);
      }
      if (groups !== t.group_count) changes.push(`조 ${groups}개`);
      if (changes.length === 0) break;
      conn
        .prepare("UPDATE tournaments SET name = ?, mode = ?, rules = ?, planned_rounds = ?, group_count = ? WHERE id = ?")
        .run(name, mode, JSON.stringify(rules), planned, groups, t.id);
      bump(t, user, `설정 변경: ${changes.join(", ")}`);
      notices.push("설정을 저장했습니다.");
      break;
    }
    default:
      throw new OpError("알 수 없는 요청입니다.");
  }
  return { ok: errors.length === 0, version: versionOf(t.id), notices, errors, undo };
}

export function myTournaments(user: User): MyTournament[] {
  const rows = db()
    .prepare(
      `SELECT t.code, t.name, m.role, t.updated_at, t.mode, t.group_count,
        (SELECT COALESCE(MAX(r.round_no), 0) FROM rounds r WHERE r.tournament_id = t.id AND r.deleted_at IS NULL) AS played
       FROM members m JOIN tournaments t ON t.id = m.tournament_id WHERE m.user_id = ? ORDER BY t.updated_at DESC`,
    )
    .all(user.id) as { code: string; name: string; role: "owner" | "operator"; updated_at: number; mode: Mode; group_count: number; played: number }[];
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    role: r.role,
    expiresAt: r.updated_at + RETENTION_MS,
    mode: r.mode,
    groupCount: r.group_count,
    played: r.played,
  }));
}

function requireOwner(code: string, user: User): TRow {
  const { t, role } = findRole(code, user);
  if (role !== "owner") throw new OpError("개최자만 할 수 있습니다.");
  return t;
}

export function members(code: string, user: User): { members: MemberRow[]; invites: InviteRow[] } {
  const { t, role } = findRole(code, user);
  const list = db()
    .prepare("SELECT u.id, u.name, u.avatar, m.role, m.joined_at FROM members m JOIN users u ON u.id = m.user_id WHERE m.tournament_id = ? ORDER BY m.role = 'owner' DESC, m.joined_at")
    .all(t.id) as { id: string; name: string; avatar: string | null; role: "owner" | "operator"; joined_at: number }[];
  const invites =
    role === "owner"
      ? (
          db().prepare("SELECT token, created_at, uses_left FROM invites WHERE tournament_id = ? ORDER BY created_at").all(t.id) as {
            token: string;
            created_at: number;
            uses_left: number;
          }[]
        ).map((i) => ({ token: i.token, createdAt: i.created_at, usesLeft: i.uses_left }))
      : [];
  return { members: list.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, role: m.role, joinedAt: m.joined_at })), invites };
}

function inviteSlots(tournamentId: number): number {
  const ops = db().prepare("SELECT COUNT(*) AS n FROM members WHERE tournament_id = ? AND role = 'operator'").get(tournamentId) as { n: number };
  const pending = db().prepare("SELECT COALESCE(SUM(uses_left), 0) AS n FROM invites WHERE tournament_id = ?").get(tournamentId) as { n: number };
  return LIMITS.operators - ops.n - pending.n;
}

export function createInvite(code: string, user: User, uses = 1): string {
  const t = requireOwner(code, user);
  const n = Math.floor(Number(uses));
  if (!Number.isFinite(n) || n < 1) throw new OpError("인원은 1명 이상이어야 합니다.");
  const slots = inviteSlots(t.id);
  if (slots <= 0) throw new OpError(`운영자는 개최자 외 최대 ${LIMITS.operators}명입니다. 쓰지 않을 초대 링크를 취소해주세요.`);
  if (n > slots) throw new OpError(`지금은 ${slots}명까지 더 초대할 수 있습니다.`);
  const tk = token(12);
  db().prepare("INSERT INTO invites(token, tournament_id, created_by, created_at, uses_left) VALUES (?, ?, ?, ?, ?)").run(tk, t.id, user.id, now(), n);
  return tk;
}

export function cancelInvite(code: string, user: User, tk: string) {
  const t = requireOwner(code, user);
  db().prepare("DELETE FROM invites WHERE token = ? AND tournament_id = ?").run(tk, t.id);
}

export type InviteInfo = { code: string; name: string; mode: Mode; plannedRounds: number; groupCount: number; inviter: string; usesLeft: number } | null;

export function inviteInfo(tk: string): InviteInfo {
  const row = db()
    .prepare(
      "SELECT t.code, t.name, t.mode, t.planned_rounds, t.group_count, u.name AS inviter, i.uses_left FROM invites i JOIN tournaments t ON t.id = i.tournament_id LEFT JOIN users u ON u.id = i.created_by WHERE i.token = ?",
    )
    .get(tk) as { code: string; name: string; mode: Mode; planned_rounds: number; group_count: number; inviter: string | null; uses_left: number } | undefined;
  if (!row) return null;
  return { code: row.code, name: row.name, mode: row.mode, plannedRounds: row.planned_rounds, groupCount: row.group_count, inviter: row.inviter ?? "개최자", usesLeft: row.uses_left };
}

export function acceptInvite(tk: string, user: User): { code: string; already: boolean } {
  return tx(() => {
    const inv = db().prepare("SELECT tournament_id, uses_left, created_at FROM invites WHERE token = ?").get(tk) as
      | { tournament_id: number; uses_left: number; created_at: number }
      | undefined;
    if (!inv) throw new OpError("인원이 다 찼거나 취소된 초대 링크입니다. 개최자에게 새 링크를 요청해주세요.");
    const t = db().prepare("SELECT * FROM tournaments WHERE id = ?").get(inv.tournament_id) as TRow;
    if (roleOf(t, user)) return { code: t.code, already: true };
    const gone = db().prepare("SELECT removed_at FROM removals WHERE tournament_id = ? AND user_id = ?").get(t.id, user.id) as { removed_at: number } | undefined;
    if (gone && gone.removed_at >= inv.created_at) throw new OpError("이 링크로는 다시 참여할 수 없습니다. 개최자에게 새 링크를 요청해주세요.");
    const n = db().prepare("SELECT COUNT(*) AS n FROM members WHERE tournament_id = ? AND role = 'operator'").get(t.id) as { n: number };
    if (n.n >= LIMITS.operators) throw new OpError(`운영자는 개최자 외 최대 ${LIMITS.operators}명입니다. 개최자에게 문의해주세요.`);
    if (inv.uses_left > 1) db().prepare("UPDATE invites SET uses_left = uses_left - 1 WHERE token = ?").run(tk);
    else db().prepare("DELETE FROM invites WHERE token = ?").run(tk);
    db().prepare("INSERT INTO members(tournament_id, user_id, role, joined_at) VALUES (?, ?, 'operator', ?)").run(t.id, user.id, now());
    bump(t, user, "운영자로 참여");
    return { code: t.code, already: false };
  });
}

export function removeMember(code: string, user: User, target: string) {
  const { t, role } = findRole(code, user);
  const self = target === user.id;
  if (self) {
    if (role === "owner") throw new OpError("개최자는 다른 운영자에게 개최자를 넘긴 뒤 나갈 수 있습니다.");
  } else if (role !== "owner") {
    throw new OpError("개최자만 운영자를 뺄 수 있습니다.");
  }
  tx(() => {
    const m = db()
      .prepare("SELECT u.name, m.role FROM members m JOIN users u ON u.id = m.user_id WHERE m.tournament_id = ? AND m.user_id = ?")
      .get(t.id, target) as { name: string; role: string } | undefined;
    if (!m || m.role === "owner") return;
    db().prepare("DELETE FROM members WHERE tournament_id = ? AND user_id = ?").run(t.id, target);
    // 내보낸 사람과, 개최자일 때 만든 링크를 남기고 나간 사람은 전에 있던 링크로 재참여 불가. 남은 링크는 다른 사람이 그대로 사용
    const minted = db().prepare("SELECT 1 FROM invites WHERE tournament_id = ? AND created_by = ?").get(t.id, target);
    if (!self) db().prepare("DELETE FROM invites WHERE tournament_id = ? AND created_by = ?").run(t.id, target);
    if (!self || minted) {
      db()
        .prepare("INSERT INTO removals(tournament_id, user_id, removed_at) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET removed_at = excluded.removed_at")
        .run(t.id, target, now());
    }
    bump(t, user, self ? "운영자 그만두기" : `운영자에서 빼기: ${m.name}`);
  });
}

export function transferOwner(code: string, user: User, target: string) {
  const t = requireOwner(code, user);
  tx(() => {
    const m = db()
      .prepare("SELECT u.name, m.role FROM members m JOIN users u ON u.id = m.user_id WHERE m.tournament_id = ? AND m.user_id = ?")
      .get(t.id, target) as { name: string; role: string } | undefined;
    if (!m || m.role !== "operator") throw new OpError("이 대회의 운영자에게만 넘길 수 있습니다.");
    db().prepare("UPDATE members SET role = 'operator' WHERE tournament_id = ? AND user_id = ?").run(t.id, user.id);
    db().prepare("UPDATE members SET role = 'owner' WHERE tournament_id = ? AND user_id = ?").run(t.id, target);
    bump(t, user, `개최자 넘기기: ${m.name}`);
  });
}

// 업로드 키는 조마다 하나. 평문은 발급 응답에만 있고 DB에는 해시만 둠
export function uploadKeys(code: string, user: User): UploadKeyRow[] {
  const { t } = findRole(code, user);
  const rows = db()
    .prepare("SELECT k.group_idx, k.created_at, k.last_used_at, u.name FROM upload_keys k LEFT JOIN users u ON u.id = k.created_by WHERE k.tournament_id = ? AND k.group_idx < ? ORDER BY k.group_idx")
    .all(t.id, t.group_count) as { group_idx: number; created_at: number; last_used_at: number | null; name: string | null }[];
  return rows.map((r) => ({ group: r.group_idx, createdBy: r.name ?? "", createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export function issueUploadKey(code: string, user: User, group: unknown): { key: string; label: string } {
  const { t } = findRole(code, user);
  const g = assertGroup(t, group);
  return tx(() => {
    if (db().prepare("SELECT 1 FROM upload_keys WHERE tournament_id = ? AND group_idx = ?").get(t.id, g)) {
      throw new OpError(`${groupLabel(g)}조에는 이미 업로드 키가 있습니다. 폐기한 뒤 다시 발급해주세요.`);
    }
    const key = token(32);
    db().prepare("INSERT INTO upload_keys(tournament_id, group_idx, hash, created_by, created_at) VALUES (?, ?, ?, ?, ?)").run(t.id, g, hash(key), user.id, now());
    bump(t, user, `${prefix(t, g)}업로드 키 발급`);
    return { key, label: groupLabel(g) };
  });
}

export function revokeUploadKey(code: string, user: User, group: unknown) {
  const { t } = findRole(code, user);
  const g = typeof group === "number" ? group : -1;
  tx(() => {
    if (Number(db().prepare("DELETE FROM upload_keys WHERE tournament_id = ? AND group_idx = ?").run(t.id, g).changes) > 0) bump(t, user, `${prefix(t, g)}업로드 키 폐기`);
  });
}

type KeyRow = { t: TRow; g: number; hash: string; issuer: User; role: "owner" | "operator" };

// 주소의 대회와 조가 키와 다르거나, 발급한 사람이 운영진에서 빠졌거나, 보관 기간이 지났으면 없는 키로 봄
function keyRow(code: string, group: string, key: string): KeyRow | null {
  if (!key || key.length > 100) return null;
  const k = db()
    .prepare(
      "SELECT k.tournament_id, k.group_idx, k.hash, u.id AS uid, u.name, u.avatar, m.role FROM upload_keys k JOIN members m ON m.tournament_id = k.tournament_id AND m.user_id = k.created_by JOIN users u ON u.id = k.created_by WHERE k.hash = ?",
    )
    .get(hash(key)) as { tournament_id: number; group_idx: number; hash: string; uid: string; name: string; avatar: string | null; role: "owner" | "operator" } | undefined;
  if (!k) return null;
  const t = find(code);
  if (!t || t.id !== k.tournament_id || k.group_idx >= t.group_count || groupLabel(k.group_idx) !== group.toUpperCase()) return null;
  if (t.updated_at + RETENTION_MS <= now()) return null;
  return { t, g: k.group_idx, hash: k.hash, issuer: { id: k.uid, name: k.name, avatar: k.avatar }, role: k.role };
}

export function uploadKeyId(code: string, group: string, key: string): string | null {
  return keyRow(code, group, key)?.hash ?? null;
}

export type UploadResult = { status: "gone" | "ended" | "duplicate" | "invalid" | "added"; message: string };

export function uploadWithKey(code: string, group: string, key: string, file: { name: string; text: string }): UploadResult {
  return tx(() => {
    const k = keyRow(code, group, key);
    if (!k) return { status: "gone", message: "" };
    const { t, g } = k;
    if (groupResult(loadView(t.code, null)!, g).ended) return { status: "ended", message: t.group_count > 1 ? `${groupLabel(g)}조 경기가 끝났습니다.` : "끝난 대회입니다." };
    const parsed = parseRoundCsv(file.text);
    if (parsed.ok) {
      const dup = db()
        .prepare("SELECT group_idx, round_no FROM rounds WHERE tournament_id = ? AND game_id = ? AND deleted_at IS NULL")
        .get(t.id, parsed.round.gameId) as { group_idx: number; round_no: number } | undefined;
      if (dup) return { status: "duplicate", message: `이미 ${prefix(t, dup.group_idx)}${dup.round_no}라운드에 올린 경기입니다.` };
    }
    const r = runOp(t, k.role, k.issuer, { op: "add_csv", group: g, files: [file] }, " (자동 업로드)");
    if (!r.ok) return { status: "invalid", message: r.errors.join("\n").replace(/^[^:\n]*: /gm, "") };
    db().prepare("UPDATE upload_keys SET last_used_at = ? WHERE hash = ?").run(now(), k.hash);
    return { status: "added", message: r.notices.join("\n") };
  });
}

export function deleteTournament(code: string, user: User, confirmName: string) {
  const t = requireOwner(code, user);
  if (clean(confirmName, LIMITS.nameLength) !== t.name) throw new OpError("대회 이름이 일치하지 않습니다. 대회 이름을 다시 확인해주세요.");
  db().prepare("DELETE FROM tournaments WHERE id = ?").run(t.id);
}

export function cleanup(): { tournaments: number; sessions: number; users: number } {
  const conn = db();
  const t = now();
  const tournaments = Number(conn.prepare("DELETE FROM tournaments WHERE updated_at < ?").run(t - RETENTION_MS).changes);
  conn.prepare("DELETE FROM rounds WHERE deleted_at IS NOT NULL AND deleted_at < ?").run(t - 60 * 60 * 1000);
  conn.prepare("DELETE FROM penalties WHERE deleted_at IS NOT NULL AND deleted_at < ?").run(t - 60 * 60 * 1000);
  const sessions = Number(conn.prepare("DELETE FROM sessions WHERE expires_at < ?").run(t).changes);
  const users = Number(
    conn
      .prepare("DELETE FROM users WHERE id NOT IN (SELECT user_id FROM sessions) AND id NOT IN (SELECT user_id FROM members)")
      .run().changes,
  );
  if ((conn.prepare("PRAGMA freelist_count").get() as { freelist_count: number }).freelist_count > 1024) conn.exec("PRAGMA incremental_vacuum; PRAGMA wal_checkpoint(TRUNCATE);");
  return { tournaments, sessions, users };
}

export type { PenaltyInput, RoundRow };
