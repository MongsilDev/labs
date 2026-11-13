// 공식 API의 모든 경기를 경기 번호 순서대로 따라가며 응답 원본(닉네임 포함), 행, 닉네임 표를 보관함. 경기 자료는 약 90일 뒤 조회되지 않음
// 닉네임은 공개 화면에 내보내지 않음(사용자 결정 380-2). labs 화면은 이 DB를 읽지 않음
// 사용: node scripts/er/tier/archive.mjs --from <첫 경기 번호> [--rps 40] [--once]. 받은 위치는 DB에 남아 다시 실행하면 이어 받음
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { brotliCompressSync, constants as zlib } from "node:zlib";
import { Pace, botLast429 } from "./pace.mjs";
import { preRow } from "./preseason.mjs";

const DIR = process.env.ARCHIVE_DIR || "/Volumes/SSD/ertier/archive";
const LIVE = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
const BOT = process.env.BOT_DIR || join(homedir(), "docker/mongsil-bot");
const API = process.env.TIER_API || "https://open-api.bser.io";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};
const ONCE = args.includes("--once");
// 같은 키를 쓰는 몽실봇, 스크림봇, 스텔라봇 몫을 남기려고 한도 50보다 낮춤
const MAX_RPS = 40;
const MIN_RPS = 20;
const STEP_DOWN = 5;
// 3시간 수집 회차(2시부터 3시간마다 25분)와 겹치지 않게 회차 20분 전부터 회차가 끝날 때까지 쉼
const ROUND_MS = 3 * 3600_000;
const ROUND_OFFSET = (2 * 60 + 25) * 60_000 - 9 * 3600_000;
const QUIET_MS = Number(process.env.ARCHIVE_QUIET_MS ?? 20 * 60_000);
const CHUNK = 2000;
const MISS_MAX = 3;
// 시작한 지 한 시간이 안 된 번호에는 아직 진행 중인 경기가 섞여 있어 다음 차례로 미룸
const LAG_MS = 3600_000;
const IDLE_MS = 30 * 60_000;

const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kst = (s) => Date.parse(s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
const clock = (t) => new Date(t).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }).slice(5, 16);

const KEY = readFileSync(join(BOT, ".env"), "utf8").match(/^API_KEY=["']?([^"'\r\n]+)/m)?.[1];
if (!KEY) throw new Error("API_KEY를 찾지 못했습니다.");

mkdirSync(DIR, { recursive: true });
const db = new DatabaseSync(join(DIR, "games.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS games (game INTEGER PRIMARY KEY, t INTEGER NOT NULL, season INTEGER NOT NULL, mode INTEGER NOT NULL, n INTEGER NOT NULL, body BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS nicks (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS rows (
    game INTEGER NOT NULL, slot INTEGER NOT NULL, season INTEGER NOT NULL, t INTEGER NOT NULL, mode INTEGER NOT NULL, server TEXT,
    team INTEGER, rank INTEGER, char INTEGER, weapon INTEGER, bot INTEGER, weather INTEGER,
    exp TEXT, exp_reward INTEGER, exp_credit INTEGER, gadgets TEXT, drops TEXT, lumi INTEGER, quest TEXT, equip TEXT, robot INTEGER,
    nick INTEGER,
    PRIMARY KEY (game, slot)
  );
  CREATE INDEX IF NOT EXISTS rows_season ON rows (season, mode);
  CREATE INDEX IF NOT EXISTS rows_nick ON rows (nick);
  CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS miss (id INTEGER PRIMARY KEY, n INTEGER NOT NULL);
`);
const getState = (k) => db.prepare(`SELECT v FROM state WHERE k = ?`).get(k)?.v ?? null;
const setState = db.prepare(`INSERT INTO state VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`);
const putGame = db.prepare(`INSERT OR REPLACE INTO games VALUES (?, ?, ?, ?, ?, ?)`);
const putRow = db.prepare(`INSERT OR REPLACE INTO rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const addNick = db.prepare(`INSERT OR IGNORE INTO nicks (name) VALUES (?)`);
const nickId = db.prepare(`SELECT id FROM nicks WHERE name = ?`);
const putMiss = db.prepare(`INSERT INTO miss VALUES (?, 1) ON CONFLICT(id) DO UPDATE SET n = n + 1`);

const stats = { sent: 0, limited: 0, failed: 0, games: 0, ids: 0 };
const pace = new Pace(Math.min(MAX_RPS, opt("rps", getState("rps") ?? MAX_RPS)));
let lastDown = 0;
/** 429를 받거나 몽실봇이 429를 받으면 초당 5회씩, 최소 MIN_RPS까지 낮추고 낮춘 값을 다음 실행에도 씀 */
function slowDown(why) {
  if (Date.now() - lastDown < 60_000) return;
  lastDown = Date.now();
  const next = Math.max(MIN_RPS, pace.rps - STEP_DOWN);
  if (next >= pace.rps) return;
  pace.set(next);
  setState.run("rps", next);
  log(`${why} 초당 ${next}회로 낮춥니다.`);
}

const startedAt = Date.now();
let botSeen = botLast429() ?? 0;
setInterval(() => {
  const last = botLast429();
  if (last && last > botSeen && last >= startedAt) {
    botSeen = last;
    slowDown("몽실봇 로그에 429가 기록돼");
  }
}, 30_000).unref();

/** 응답 원문과 본문. 404는 null, 다섯 번 실패는 undefined */
async function get(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await pace.take();
    stats.sent++;
    try {
      const res = await fetch(API + path, { headers: { "x-api-key": KEY, "user-agent": "agent-local" }, signal: AbortSignal.timeout(20_000) });
      const text = res.status === 200 ? await res.text() : "";
      const body = text ? JSON.parse(text) : null;
      const code = body?.code ?? res.status;
      if (res.status === 429 || res.status === 403 || code === 429) {
        stats.limited++;
        pace.limited((Number(res.headers.get("retry-after")) || 1) * 1000);
        slowDown("429 응답을 받아");
        continue;
      }
      if (res.status === 404 || code === 404) return null;
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return { text, body };
    } catch (e) {
      stats.failed++;
      if (attempt === 4) log("요청 실패", path.replace(/\d{4,}/g, "#"), e.message);
      await sleep(2000);
    }
  }
  return undefined;
}

/** 시즌 시작 시각 오름차순. 경기는 시작 시각이 속한 마지막 시즌으로 셈(일반과 코발트는 seasonId가 0이라서) */
let seasons = [];
async function loadSeasons() {
  const list = (await get("/v2/data/Season"))?.body?.data ?? [];
  if (list.length) seasons = list.map((s) => ({ id: s.seasonID, start: kst(`${s.seasonStart}+0900`) })).sort((a, b) => a.start - b.start);
}
const seasonAt = (t) => seasons.findLast((s) => s.start <= t)?.id ?? 0;

/** 경기 번호 id부터 위로 열 개 안에서 처음 조회되는 경기의 시작 시각. 없으면 null */
async function gameAt(id) {
  for (let k = 0; k < 10; k++) {
    const y = (await get(`/v1/games/${id + k}`))?.body?.userGames?.[0];
    if (y) return { id: id + k, t: kst(y.startDtm) };
  }
  return null;
}

/** cursor 위에서 시작 시각이 until 이하인 마지막 번호. 빈 번호가 열 개 넘게 이어진 곳에 걸려 멈추지 않게, 경기를 못 찾으면 네 번까지 두 배씩 넓혀 봄 */
async function lastBefore(cursor, until) {
  let known = null;
  let top = null;
  for (let step = CHUNK; step <= CHUNK * 8; step *= 2) {
    const g = await gameAt(cursor + step);
    if (g && g.t <= until) known = g.id;
    else if (g || known) {
      top = cursor + step;
      break;
    }
  }
  if (!known) return cursor;
  let lo = known;
  let hi = top ?? known;
  while (hi - lo > 20) {
    const mid = Math.floor((lo + hi) / 2);
    const g = await gameAt(mid);
    if (g && g.t <= until) lo = g.id;
    else hi = mid;
  }
  return lo;
}

/** 받은 경기 하나를 행과 원본으로 바꿈. 원본은 응답 원문 그대로 brotli */
function shape(id, { text, body }) {
  const list = body?.userGames ?? [];
  if (!list.length) return null;
  const t = kst(list[0].startDtm);
  const season = seasonAt(t);
  return {
    game: [id, t, season, list[0].matchingMode, list.length, brotliCompressSync(text, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9 } })],
    rows: list.map((y, i) => [preRow(season, id, i, y), y.nickname ?? null]),
  };
}

function save(done) {
  db.exec("BEGIN");
  try {
    for (const g of done) {
      putGame.run(...g.game);
      for (const [row, name] of g.rows) {
        let nick = null;
        if (name) {
          addNick.run(name);
          nick = nickId.get(name).id;
        }
        putRow.run(...row, nick);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

/** ids를 나눠 받아 저장하고 받지 못한 번호를 돌려줌 */
async function fetchIds(ids) {
  const done = [];
  const missed = [];
  let k = 0;
  await Promise.all(
    Array.from({ length: Math.max(4, Math.ceil(pace.rps)) }, async () => {
      while (k < ids.length) {
        const id = ids[k++];
        const r = await get(`/v1/games/${id}`);
        if (r === undefined) missed.push(id);
        else if (r) {
          const g = shape(id, r);
          if (g) done.push(g);
        }
      }
    }),
  );
  save(done);
  stats.games += done.length;
  stats.ids += ids.length;
  return missed;
}

const nextRound = (now) => Math.ceil((now - ROUND_OFFSET) / ROUND_MS) * ROUND_MS + ROUND_OFFSET;

/** collect.log 마지막 줄이 start 뒤에 끝난 기록이면 회차가 끝난 것 */
function roundDone(start) {
  try {
    const last = readFileSync(join(LIVE, "collect.log"), "utf8").trimEnd().split("\n").at(-1) ?? "";
    const t = Date.parse(`${last.slice(0, 19).replace(" ", "T")}+09:00`);
    return t >= start - 60_000 && /exit -?\d+$|건너뜀$/.test(last);
  } catch {
    return false;
  }
}

/** 회차가 가까우면 회차가 끝날 때까지 기다리고 true. 한 시간이 지나도 끝난 기록이 없으면 이어 감 */
async function waitRound() {
  const now = Date.now();
  const next = nextRound(now);
  if (next - now > QUIET_MS) return false;
  log(`${clock(next)} 3시간 수집 회차 전이라 쉽니다.`);
  await sleep(next - now + 60_000);
  while (Date.now() < next + 3600_000 && !roundDone(next)) await sleep(30_000);
  log("회차가 끝나 경기를 이어 받습니다.");
  return true;
}

let lastReport = 0;
let lastSeason = null;
function report(cursor, hi, force = false) {
  const now = Date.now();
  if (!force && now - lastReport < 5 * 60_000) return;
  const rate = stats.ids / ((now - startedAt) / 1000);
  const left = Math.max(0, hi - cursor);
  const eta = rate > 0 ? now + (left / rate) * 1000 : null;
  const status = { at: now, cursor, hi, left, rps: pace.rps, idsPerSec: +rate.toFixed(1), eta, ...stats };
  writeFileSync(join(DIR, "status.json.tmp"), JSON.stringify(status));
  renameSync(join(DIR, "status.json.tmp"), join(DIR, "status.json"));
  log(
    `번호 ${cursor} / ${hi}, 남은 번호 ${left}, 이번 실행 경기 ${stats.games}개, 쉬는 시간 포함 번호 초당 ${rate.toFixed(1)}개, 설정 초당 ${pace.rps}회, 429 ${stats.limited}, 실패 ${stats.failed}, 예상 종료 ${eta ? clock(eta) : "-"}`,
  );
  lastReport = now;
}

/** 받지 못한 번호를 한 번 더 받음. MISS_MAX회 실패한 번호는 건너뜀 */
async function retryMisses() {
  const ids = db.prepare(`SELECT id FROM miss WHERE n < ? ORDER BY id`).all(MISS_MAX).map((r) => r.id);
  if (!ids.length) return;
  const still = new Set(await fetchIds(ids));
  db.exec("BEGIN");
  for (const id of ids) {
    if (still.has(id)) putMiss.run(id);
    else db.prepare(`DELETE FROM miss WHERE id = ?`).run(id);
  }
  db.exec("COMMIT");
  const gave = db.prepare(`SELECT count(*) AS n FROM miss WHERE n >= ?`).get(MISS_MAX).n;
  log(`받지 못한 번호 ${ids.length}개를 다시 받아 ${ids.length - still.size}개를 처리했습니다.${gave ? ` ${MISS_MAX}회 실패해 건너뛴 번호는 모두 ${gave}개입니다.` : ""}`);
}

let cursor = getState("cursor") ?? opt("from", NaN) - 1;
if (!Number.isFinite(cursor)) throw new Error("처음 실행할 때는 --from 뒤에 첫 경기 번호를 적어 주세요.");
log(`경기 보관을 시작합니다. 번호 ${cursor + 1}부터 초당 ${pace.rps}회로 받습니다.`);
for (;;) {
  await waitRound();
  await loadSeasons();
  const from = cursor;
  const hi = await lastBefore(cursor, Date.now() - LAG_MS);
  report(cursor, hi, true);
  while (cursor < hi) {
    if (await waitRound()) break;
    const end = Math.min(cursor + CHUNK, hi);
    const missed = await fetchIds(Array.from({ length: end - cursor }, (_, i) => cursor + 1 + i));
    db.exec("BEGIN");
    for (const id of missed) putMiss.run(id);
    setState.run("cursor", end);
    db.exec("COMMIT");
    cursor = end;
    const s = db.prepare(`SELECT season FROM games WHERE game <= ? ORDER BY game DESC LIMIT 1`).get(cursor)?.season ?? null;
    if (lastSeason !== null && s !== null && s !== lastSeason) log(`시즌 ${lastSeason} 경기를 끝까지 받고 시즌 ${s} 경기로 넘어갔습니다.`);
    if (s !== null) lastSeason = s;
    report(cursor, hi);
  }
  await retryMisses();
  report(cursor, hi, true);
  if (ONCE) break;
  // 최근 번호까지 따라잡았으면 새 경기가 쌓일 때까지 쉼
  if (cursor - from < CHUNK) await sleep(IDLE_MS);
}
db.close();
