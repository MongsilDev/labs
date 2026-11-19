// 매시 정각 회차는 순위표 1건으로 이터컷을 계산해 쓰고, 보관기로 지난 회차 뒤의 경기를 받은 다음 휴면 판정과 티어 집계를 이어 간다
// 공식 API를 정기적으로 부르는 곳은 이 회차뿐이고 몽실봇은 여기서 쓴 파일을 읽기만 함(장부 510)
// 사용: node scripts/er/tier/hourly.mjs. LaunchAgent가 매시 0분에 띄우고, 회차가 정각을 넘겨 돌면 launchd가 다음 회차를 띄우지 않음
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { CHECKED, LAST_GAME, NO_RECENT, UID, UNREADABLE, loadState, needsCheck, playerBook, rankedSeason, record, saveState, snapshot } from "./etercut.mjs";
import { Pace } from "./pace.mjs";
import { loadRace, raceBoard, scanArchive } from "./race.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = homedir();
const BOT = process.env.BOT_DIR || join(HOME, "docker/mongsil-bot");
const API = process.env.TIER_API || "https://open-api.bser.io";
const ARCHIVE = process.env.ARCHIVE_DIR || "/Volumes/SSD/ertier/archive";
const TIER = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
// 닉네임이 든 파일은 labs 화면 경로 밖인 몽실봇 자료 폴더에 둠. cut.json에는 닉네임이 없음
const LABS = join(BOT, "data/labs");
const CUT_STATE = process.env.CUT_STATE || join(LABS, "rank_history.json");
const CUT_SNAPSHOTS = process.env.CUT_SNAPSHOTS || join(LABS, "rank_snapshots.jsonl");
const CUT_TOP = process.env.CUT_TOP || join(LABS, "top.json");
const CUT_DIR = process.env.CUT_DIR || join(HOME, "docker/_data/labs/er-cut");
const RACE_STATE = process.env.RACE_STATE || join(LABS, "race_state.json");
// 0이면 보관기 단계를 건너뛰고 ARCHIVE_DIR의 DB를 읽기만 함. 운영 보관기와 나란히 도는 시험 회차가 같은 경기를 두 번 받지 않게 한다
const ARCHIVE_RPS = process.env.HOURLY_ARCHIVE_RPS;
// 이 회차와 집계기의 초당 요청 상한. 상주 보관기와 같이 돌 때 합이 초당 45회를 넘지 않게 낮춘다
const RPS = Number(process.env.HOURLY_RPS) || 20;
// 회차마다 경기 목록으로 휴면을 확인하는 계정 수 상한. 몽실봇이 1분마다 확인하던 수와 같음
const CHECK_MAX = 50;
const PAGES = 15;
// 보관기 마지막 경기가 이보다 오래됐으면 보관기로 휴면을 판정하지 않음
const ARCHIVE_FRESH = 3 * 3600_000;

const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }), ...a);
const kst = (s) => Date.parse(s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));

const KEY = readFileSync(join(BOT, ".env"), "utf8").match(/^API_KEY=["']?([^"'\r\n]+)/m)?.[1];
if (!KEY) throw new Error("API_KEY를 찾지 못했습니다.");

const pace = new Pace(RPS);
const stats = { sent: 0, limited: 0, failed: 0 };
/** 본문. 404는 null, 다섯 번 실패는 undefined */
async function get(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await pace.take();
    stats.sent++;
    try {
      const res = await fetch(API + path, { headers: { "x-api-key": KEY, "user-agent": "agent-local" }, signal: AbortSignal.timeout(20_000) });
      const body = res.status === 200 ? await res.json() : null;
      const code = body?.code ?? res.status;
      if (res.status === 429 || res.status === 403 || code === 429) {
        stats.limited++;
        pace.limited((Number(res.headers.get("retry-after")) || 1) * 1000);
        continue;
      }
      if (res.status === 404 || code === 404) return null;
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      return body;
    } catch (e) {
      stats.failed++;
      if (attempt === 4) log("요청 실패", path.split("?")[0].replace(/\/[^/]*\d{4,}[^/]*$/, "/#"), e.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  return undefined;
}

function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = join(dirname(file), `.${file.split("/").at(-1)}.${process.pid}`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

/** 보관기 DB로 휴면 후보의 이 시즌 마지막 랭크 경기 시각을 찾음. 찾지 못한 닉네임 목록을 돌려줌 */
function archiveActivity(sid, todo, now) {
  const file = join(ARCHIVE, "games.sqlite");
  if (!existsSync(file)) return { found: 0, left: todo, skipped: "보관기 DB가 없습니다." };
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const top = db.prepare(`SELECT max(game) AS g FROM games`).get().g;
    const lastT = top == null ? 0 : db.prepare(`SELECT t FROM games WHERE game = ?`).get(top).t;
    if (now * 1000 - lastT > ARCHIVE_FRESH) return { found: 0, left: todo, skipped: "보관기의 마지막 경기가 3시간보다 오래되었습니다." };
    const nick = db.prepare(`SELECT id FROM nicks WHERE name = ?`);
    const last = db.prepare(`SELECT max(t) AS t FROM rows WHERE nick = ? AND season = ? AND mode = 3`);
    const left = [];
    let found = 0;
    for (const [name, p] of todo) {
      const id = nick.get(name)?.id;
      const t = id == null ? null : last.get(id, sid).t;
      if (t == null) {
        left.push([name, p]);
        continue;
      }
      p[LAST_GAME] = t / 1000;
      p[CHECKED] = now;
      found++;
    }
    return { found, left };
  } finally {
    db.close();
  }
}

/** 몽실봇 last_ranked_game과 같음. uid와 이 시즌 마지막 랭크 게임 시각. 기록 끝까지 없으면 NO_RECENT, 다 읽지 못하면 UNREADABLE, 실패는 null */
async function lastRankedGame(name, sid, uid) {
  const cached = Boolean(uid);
  if (!uid) {
    const data = await get(`/v1/user/nickname?query=${encodeURIComponent(name)}`);
    if (data === undefined) return [null, null];
    const user = data?.user ?? {};
    uid = user.userId ?? user.uid;
    if (!uid) return [null, null];
  }
  let path = `/v1/user/games/uid/${uid}`;
  for (let i = 0; i < PAGES; i++) {
    const data = await get(path);
    if (data === undefined) return [uid, null];
    // 저장해 둔 uid가 무효가 되면 404가 나서 닉네임으로 다시 찾는다
    if (data === null && i === 0 && cached) return lastRankedGame(name, sid, null);
    const games = data?.userGames ?? [];
    for (const g of games) if (g.matchingMode === 3 && g.seasonId === sid) return [uid, kst(g.startDtm) / 1000];
    if (!games.length || !data.next) return [uid, NO_RECENT];
    path = `/v1/user/games/uid/${uid}?next=${data.next}`;
  }
  return [uid, UNREADABLE];
}

async function apiActivity(sid, todo, now) {
  let k = 0;
  await Promise.all(
    Array.from({ length: 10 }, async () => {
      while (k < todo.length) {
        const [name, p] = todo[k++];
        let uid = null, at = null;
        try {
          [uid, at] = await lastRankedGame(name, sid, p[UID]);
        } catch {}
        p[CHECKED] = now;
        if (uid) p[UID] = uid;
        if (at != null) p[LAST_GAME] = at;
      }
    }),
  );
}

function run(step, script, args) {
  const r = spawnSync(process.execPath, [join(HERE, script), ...args], { stdio: "inherit", env: process.env });
  if (r.status !== 0) throw new Error(`${script} 종료 코드 ${r.status ?? r.signal}`);
}

const started = Date.now();
const hour = Math.floor(started / 3600_000) * 3600_000;
// 정각에 뜨지 못한 회차도 다음 정각 전에 끝나게 보관기에 시간을 나눠 줌
const deadline = started < hour + 50 * 60_000 ? hour + 50 * 60_000 : started + 5 * 60_000;
const status = { at: started, steps: [] };
let failed = false;
async function step(name, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    status.steps.push({ name, ms: Date.now() - t0, ok: true, ...(out && { out }) });
  } catch (e) {
    failed = true;
    status.steps.push({ name, ms: Date.now() - t0, ok: false, error: e.message });
    log(`${name} 실패: ${e.message}`);
  }
}

let season = null;
let top = null;
await step("cut", async () => {
  const now = started / 1000;
  const list = (await get("/v2/data/Season"))?.data;
  if (!Array.isArray(list)) throw new Error("시즌 목록을 받지 못했습니다.");
  season = rankedSeason(list, now);
  if (!season) throw new Error("랭크 시즌을 찾지 못했습니다.");
  const res = await get(`/v1/rank/top/${season.id}/3/10`);
  top = res === undefined ? null : (res?.topRanks ?? []);
  const state = loadState(CUT_STATE);
  record(state, { seasonId: season.id, top, fresh: season.fresh, end: season.end, now, snapshots: CUT_SNAPSHOTS });
  if (season.end && top) {
    // 휴면 후보는 몽실봇처럼 순위 순서로 고르고, 보관기로 판정하지 못한 닉네임만 다음 단계에서 경기 목록으로 확인한다
    const book = playerBook(state, season.id);
    const todo = [...top].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).filter((r) => book[r.nickname] && needsCheck(book[r.nickname], now)).map((r) => [r.nickname, book[r.nickname]]);
    const a = archiveActivity(season.id, todo, now);
    season.left = a.left.slice(0, CHECK_MAX).map(([name]) => name);
    status.dormant = { todo: todo.length, archive: a.found, left: a.left.length, ...(a.skipped && { skipped: a.skipped }) };
  }
  const cut = snapshot(state, { seasonId: season.id, seasonName: season.name, top, fresh: season.fresh, end: season.end, now });
  saveState(CUT_STATE, state);
  if (top) writeAtomic(CUT_TOP, JSON.stringify({ at: started, season: season.id, topRanks: top }));
  if (cut) writeAtomic(join(CUT_DIR, "cut.json"), JSON.stringify(cut));
  return { season: season.id, top: top?.length ?? null, cut: Boolean(cut) };
});

if (ARCHIVE_RPS === "0") status.steps.push({ name: "archive", ms: 0, ok: true, out: { skipped: true } });
else await step("archive", () => run("archive", "archive.mjs", ["--once", "--until", String(deadline), ...(ARCHIVE_RPS ? ["--rps", ARCHIVE_RPS] : [])]));

// 보관기 단계 뒤에 돌아 방금 받은 경기까지 반영함
if (season && top)
  await step("race", async () => {
    const state = loadRace(RACE_STATE, season.id);
    const now = Date.now() / 1000;
    // 300위가 8,300을 넘은 뒤에는 보관기를 더 읽지 않음
    const read = raceBoard(state, { seasonId: season.id, top, now }).open ? scanArchive(state, join(ARCHIVE, "games.sqlite")) : null;
    if (read != null) writeAtomic(RACE_STATE, JSON.stringify(state));
    const out = raceBoard(state, { seasonId: season.id, top, now });
    writeAtomic(join(CUT_DIR, "race.json"), JSON.stringify(out));
    return { read, open: out.open, count: out.count, dated: out.list.filter((r) => r.at).length };
  });

if (season?.left?.length)
  await step("dormant", async () => {
    const now = Date.now() / 1000;
    const state = loadState(CUT_STATE);
    const book = playerBook(state, season.id);
    const todo = season.left.filter((name) => book[name]).map((name) => [name, book[name]]);
    await apiActivity(season.id, todo, now);
    saveState(CUT_STATE, state);
    return { checked: todo.length };
  });

await step("collect", () => run("collect", "collect.mjs", process.env.HOURLY_RPS ? ["--rps", String(RPS)] : []));

status.ms = Date.now() - started;
status.api = stats;
// SSD가 붙지 않았을 때 내장 디스크에 TIER 경로를 만들지 않는다
if (existsSync(TIER)) writeAtomic(join(TIER, "hourly.json"), JSON.stringify(status));
log(`정각 회차 ${failed ? "일부 실패" : "완료"}, ${Math.round(status.ms / 1000)}초, ${status.steps.map((s) => `${s.name} ${Math.round(s.ms / 1000)}초${s.ok ? "" : " 실패"}`).join(", ")}`);
if (failed) process.exitCode = 1;
