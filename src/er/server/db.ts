import "server-only";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar TEXT,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  rules TEXT NOT NULL,
  planned_rounds INTEGER NOT NULL,
  group_count INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS members (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, user_id)
);
CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  uses_left INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS removals (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  removed_at INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, user_id)
);
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  round_no INTEGER NOT NULL,
  source TEXT NOT NULL,
  game_id INTEGER,
  file_name TEXT,
  players TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  discord INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS rounds_slot ON rounds(tournament_id, group_idx, round_no) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS rounds_game ON rounds(tournament_id, game_id) WHERE deleted_at IS NULL AND game_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS weather (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  round_no INTEGER NOT NULL,
  main TEXT,
  sub TEXT,
  PRIMARY KEY (tournament_id, group_idx, round_no)
);
CREATE TABLE IF NOT EXISTS penalties (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  team TEXT NOT NULL,
  round_no INTEGER NOT NULL,
  kind TEXT NOT NULL,
  count INTEGER NOT NULL,
  points REAL NOT NULL,
  reason TEXT NOT NULL,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS aliases (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  from_name TEXT NOT NULL,
  to_name TEXT NOT NULL,
  PRIMARY KEY (tournament_id, group_idx, from_name)
);
CREATE TABLE IF NOT EXISTS overrides (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  round_no INTEGER NOT NULL,
  team TEXT NOT NULL,
  state INTEGER NOT NULL,
  PRIMARY KEY (tournament_id, group_idx, round_no, team)
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS upload_keys (
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  PRIMARY KEY (tournament_id, group_idx)
);
CREATE TABLE IF NOT EXISTS discord_links (
  channel_id TEXT PRIMARY KEY,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  group_idx INTEGER NOT NULL,
  guild TEXT NOT NULL,
  channel TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_at INTEGER,
  last_status TEXT,
  last_round INTEGER,
  last_user TEXT,
  UNIQUE (tournament_id, group_idx)
);
CREATE INDEX IF NOT EXISTS logs_t ON logs(tournament_id, id);
CREATE INDEX IF NOT EXISTS members_user ON members(user_id);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
`;

const g = globalThis as unknown as { __erDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__erDb) {
    const dir = process.env.DATA_DIR || join(process.cwd(), "data");
    mkdirSync(dir, { recursive: true });
    const conn = new DatabaseSync(join(dir, "er-labs.db"));
    // 정리한 행의 빈 페이지를 파일 크기에서 돌려받으려면 incremental auto_vacuum이 필요하고, 이미 있는 파일은 VACUUM 한 번으로 바뀜
    if ((conn.prepare("PRAGMA auto_vacuum").get() as { auto_vacuum: number }).auto_vacuum !== 2) {
      try {
        conn.exec("PRAGMA busy_timeout = 5000; PRAGMA auto_vacuum = INCREMENTAL; VACUUM;");
      } catch (e) {
        // 바꾸지 못해도 연결은 그대로 쓰고 다음에 열 때 다시 시도
        console.error("[DB] auto_vacuum 전환 실패", e);
      }
    }
    conn.exec(SCHEMA);
    const cols = conn.prepare("PRAGMA table_info(invites)").all() as { name: string }[];
    if (!cols.some((c) => c.name === "uses_left")) conn.exec("ALTER TABLE invites ADD COLUMN uses_left INTEGER NOT NULL DEFAULT 1");
    const roundCols = conn.prepare("PRAGMA table_info(rounds)").all() as { name: string }[];
    if (!roundCols.some((c) => c.name === "discord")) conn.exec("ALTER TABLE rounds ADD COLUMN discord INTEGER NOT NULL DEFAULT 0");
    g.__erDb = conn;
  }
  return g.__erDb;
}

export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
}

export const now = () => Date.now();
export const DAY = 24 * 60 * 60 * 1000;
