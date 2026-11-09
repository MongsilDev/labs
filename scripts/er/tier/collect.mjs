// 아시아1 in1000 경기 기록 수집과 티어 집계. 호스트에서 실행, 원시 행은 TIER_DIR SQLite, 집계는 TIER_OUT/tier.json
// 사용: node scripts/er/tier/collect.mjs [--measure] [--rps 10] [--days 7] [--every 180] [--once] [--rebuild]
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { brotliCompressSync, brotliDecompressSync, constants as zlib } from "node:zlib";
import { RULE, scoreRows } from "./score.mjs";

const HOME = homedir();
const DIR = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
const OUT = process.env.TIER_OUT || join(HOME, "docker/_data/labs/er-tier");
const BOT = process.env.BOT_DIR || join(HOME, "docker/mongsil-bot");
const API = "https://open-api.bser.io";
const SERVER = "Asia";
const RANKED_GATE = 8300;
const SEASON_NAME_OFFSET = 9;
// 루트 작성자 배지. 시즌 12 랭크 보상 안내(playeternalreturn.com/posts/news/3921)의 이터니티 TOP 300, 데미갓 TOP 301~1,000이고 시즌마다 이 값만 고침
const AUTHOR_BADGE = [
  [300, "e"],
  [1000, "d"],
];
const PUBLISH_ROWS = Number(process.env.TIER_PUBLISH_ROWS || 15000);
const MAX_PAGES = 80;
const STEPS = [5, 10, 20, 30, 50];
const STEP_MS = 60_000;
const WINDOWS = [7];
// 패치와 상관없이 날짜로 세는 기간. 수집 기간이 모자라면 탭을 숨김
const SPANS = [28, 14];
// bestWeapon 코드와 WeaponTypeInfo 이름. 20과 23은 CharacterMastery의 쌍절곤, 카메라 전용 실험체로 대조, 12와 17은 쓰는 무기 없음
const WEAPON = {
  1: "Glove", 2: "Tonfa", 3: "Bat", 4: "Whip", 5: "HighAngleFire", 6: "DirectFire", 7: "Bow", 8: "CrossBow",
  9: "Pistol", 10: "AssaultRifle", 11: "SniperRifle", 13: "Hammer", 14: "Axe", 15: "OneHandSword",
  16: "TwoHandSword", 18: "DualSword", 19: "Spear", 20: "Nunchaku", 21: "Rapier", 22: "Guitar", 23: "Camera", 24: "Arcana",
  25: "VFArm",
};

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
// 이미 받은 최신 경기에서 멈추지 않고 since까지 거슬러 받음
const BACKFILL = flag("backfill");
// 수집 없이 DB에 있는 행으로 tier.json만 다시 씀
const PUBLISH_ONLY = flag("publish");
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : def;
};

mkdirSync(DIR, { recursive: true });
const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }), ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kst = (s) => Date.parse(s.replace(" ", "T").replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));

const KEY = readFileSync(join(BOT, ".env"), "utf8").match(/^API_KEY=["']?([^"'\r\n]+)/m)?.[1];
if (!KEY) throw new Error("API_KEY를 찾지 못했습니다.");

const keyFile = join(DIR, "player.key");
if (!existsSync(keyFile)) writeFileSync(keyFile, randomBytes(32).toString("hex"), { mode: 0o600 });
const SECRET = readFileSync(keyFile, "utf8").trim();
// userId는 조회할 때마다 값이 바뀌어 닉네임으로 같은 사람을 묶음. 닉네임을 바꾼 계정은 다른 사람으로 셈
const playerId = (season, nickname) => createHmac("sha256", SECRET).update(`${season}:${nickname}`).digest("hex").slice(0, 16);

const db = new DatabaseSync(join(DIR, "tier.sqlite"));
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS rows (
    game INTEGER NOT NULL, player TEXT NOT NULL, season INTEGER NOT NULL, t INTEGER NOT NULL, patch TEXT NOT NULL,
    char INTEGER NOT NULL, weapon INTEGER NOT NULL, trait INTEGER, rank INTEGER NOT NULL,
    gain_in INTEGER, fee INTEGER, gain INTEGER, mmr_before INTEGER, kills INTEGER, damage INTEGER,
    server TEXT, cut INTEGER, in1000 INTEGER, route INTEGER, tac INTEGER,
    PRIMARY KEY (game, player)
  );
  CREATE INDEX IF NOT EXISTS rows_t ON rows (season, t);
  CREATE TABLE IF NOT EXISTS accounts (player TEXT PRIMARY KEY, newest INTEGER, checked INTEGER);
  CREATE TABLE IF NOT EXISTS routes (route INTEGER PRIMARY KEY, author TEXT, author_rank INTEGER, version TEXT, checked INTEGER);
`);
// route와 tac은 11-09에 더한 열. 기존 행은 raw에서 채움
const rowCols = new Set(db.prepare(`PRAGMA table_info(rows)`).all().map((c) => c.name));
for (const c of ["route", "tac"]) if (!rowCols.has(c)) db.exec(`ALTER TABLE rows ADD COLUMN ${c} INTEGER`);
// 작성자 닉네임은 게임 안 루트 목록에서 공개되는 값이라 이 표에만 평문으로 둠. 경기 원본과 rows는 playerId
const routeCols = new Set(db.prepare(`PRAGMA table_info(routes)`).all().map((c) => c.name));
for (const [c, t] of [["title", "TEXT"], ["nick", "TEXT"], ["trait", "INTEGER"], ["tac", "INTEGER"]]) if (!routeCols.has(c)) db.exec(`ALTER TABLE routes ADD COLUMN ${c} ${t}`);
// /v1/games 응답 원본. 경기마다 한 번만 받고 쓸 값은 여기서 다시 고름
db.prepare(`ATTACH DATABASE ? AS raw`).run(join(DIR, "raw.sqlite"));
db.exec(`
  PRAGMA raw.journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS raw.games (game INTEGER PRIMARY KEY, season INTEGER NOT NULL, t INTEGER NOT NULL, n INTEGER NOT NULL, body BLOB NOT NULL);
  CREATE TABLE IF NOT EXISTS raw.routes (route INTEGER PRIMARY KEY, t INTEGER NOT NULL, body BLOB NOT NULL);
`);
const insertRow = db.prepare(`INSERT OR IGNORE INTO rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const fillRoute = db.prepare(`UPDATE rows SET route = ?, tac = ? WHERE game = ? AND player = ? AND route IS NULL`);
const getAccount = db.prepare(`SELECT newest FROM accounts WHERE player = ?`);
const openGames = db.prepare(`SELECT game, max(coalesce(in1000, 0)) AS top FROM rows
  WHERE season = ? AND t >= ? AND game NOT IN (SELECT game FROM raw.games) GROUP BY game ORDER BY max(t) DESC`);
const putRaw = db.prepare(`INSERT OR REPLACE INTO raw.games VALUES (?, ?, ?, ?, ?)`);
// 원본을 저장한 뒤 상위 1,000명이 새로 들어와 참가자 행이 모자란 경기
const shortGames = db.prepare(`SELECT g.game, g.body FROM raw.games g
  WHERE g.season = ? AND g.t >= ? AND g.game IN (SELECT game FROM rows WHERE season = ? AND in1000 = 1)
  AND g.n > (SELECT count(*) FROM rows x WHERE x.game = g.game)`);
const getRoute = db.prepare(`SELECT author, title, nick, trait, tac FROM routes WHERE route = ?`);
const putRoute = db.prepare(`INSERT INTO routes (route, author, version, checked, title, nick, trait, tac) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(route) DO UPDATE SET author = excluded.author, version = excluded.version, checked = excluded.checked,
  title = excluded.title, nick = excluded.nick, trait = excluded.trait, tac = excluded.tac`);
// 화면 루트 표는 상위 1,000명 행에서만 고르므로 로비 참가자 루트는 받지 않음
const openRoutes = db.prepare(
  `SELECT route FROM rows WHERE season = ? AND in1000 = 1 AND route > 0 AND route NOT IN (SELECT route FROM raw.routes) GROUP BY route ORDER BY COUNT(*) DESC`,
);
const putRawRoute = db.prepare(`INSERT OR REPLACE INTO raw.routes VALUES (?, ?, ?)`);
const hasRawRoute = db.prepare(`SELECT 1 FROM raw.routes WHERE route = ?`);
const rankRoute = db.prepare(`UPDATE routes SET author_rank = ? WHERE route = ?`);
const putAccount = db.prepare(`INSERT INTO accounts VALUES (?,?,?) ON CONFLICT(player) DO UPDATE SET newest = max(coalesce(newest, 0), excluded.newest), checked = excluded.checked`);

class Pace {
  constructor(rps) {
    this.set(rps);
    this.next = 0;
    this.slowUntil = 0;
  }
  set(rps) {
    this.rps = rps;
    this.gap = 1000 / rps;
  }
  async take() {
    const now = Date.now();
    const gap = now < this.slowUntil ? this.gap * 2 : this.gap;
    const at = Math.max(now, this.next);
    this.next = at + gap;
    if (at > now) await sleep(at - now);
  }
  limited(waitMs) {
    this.slowUntil = Date.now() + 300_000;
    this.next = Math.max(this.next, Date.now() + waitMs);
  }
}

const stats = { sent: 0, ok: 0, limited: 0, failed: 0, lat: [] };
const RATE = join(DIR, "rate.json");
const measured = existsSync(RATE) ? JSON.parse(readFileSync(RATE, "utf8")) : null;
const pace = new Pace(opt("rps", measured?.rps ?? 2));
let abort = null;

async function get(path) {
  for (let attempt = 0; attempt < 5 && !abort; attempt++) {
    await pace.take();
    stats.sent++;
    const t0 = Date.now();
    try {
      const res = await fetch(API + path, { headers: { "x-api-key": KEY, "user-agent": "agent-local" }, signal: AbortSignal.timeout(20_000) });
      const body = res.status === 200 ? await res.json() : null;
      const code = body?.code ?? res.status;
      if (res.status === 429 || res.status === 403 || code === 429) {
        stats.limited++;
        const wait = Number(res.headers.get("retry-after")) || 1;
        pace.limited(wait * 1000);
        continue;
      }
      stats.lat.push(Date.now() - t0);
      if (res.status === 404 || code === 404) return null;
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
      stats.ok++;
      return body;
    } catch (e) {
      stats.failed++;
      if (attempt === 4) log("요청 실패", path.split("?")[0].replace(/\d{4,}/g, "#"), e.message);
      await sleep(2000);
    }
  }
  // 404는 null, 다섯 번 실패나 중단은 undefined
  return undefined;
}

/** 몽실봇 로그의 마지막 429 대기 시각, 확인하지 못하면 null */
function botLast429() {
  try {
    const line = execFileSync("docker", ["exec", "bots", "sh", "-c", "grep 'API Rate limit' /var/log/supervisor/mongsil-bot.log | tail -1"], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, PATH: `/Applications/OrbStack.app/Contents/MacOS/xbin:${process.env.PATH}` },
    }).trim();
    return line ? Date.parse(`${line.slice(0, 19).replace(" ", "T")}+09:00`) : 0;
  } catch {
    return null;
  }
}

function watchBot(since, everyMs) {
  const timer = setInterval(() => {
    const last = botLast429();
    if (last && last >= since && !abort) {
      abort = "몽실봇 로그에 수집 중 429가 기록돼 수집을 멈춥니다.";
      log(abort);
    }
  }, everyMs);
  return () => clearInterval(timer);
}

async function season() {
  const list = (await get("/v2/data/Season"))?.data ?? [];
  const cur = list.find((s) => s.isCurrent === 1);
  if (!cur) return null;
  const n = Number(cur.seasonName.replace(/\D/g, "")) - SEASON_NAME_OFFSET;
  return {
    id: cur.seasonID,
    regular: cur.seasonName.startsWith("Season"),
    name: cur.seasonName.startsWith("Season") ? `정규 시즌 ${n}` : `프리 시즌 ${n}`,
    number: n,
    start: kst(`${cur.seasonStart}+0900`),
    end: kst(`${cur.seasonEnd}+0900`),
  };
}

/** 매시 순위 스냅숏의 1000위 RP. [시각 ms, RP] 오름차순 */
function cutSeries(seasonId) {
  const out = [];
  for (const line of readFileSync(join(BOT, "data/rank_snapshots.jsonl"), "utf8").split("\n")) {
    if (!line) continue;
    const s = JSON.parse(line);
    if (s.s !== seasonId || !Array.isArray(s.rp) || s.rp.length < 1000) continue;
    out.push([s.t * 1000, [...s.rp].sort((a, b) => b - a)[999]]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

function cutAt(series, t) {
  let lo = 0;
  let hi = series.length - 1;
  if (hi < 0 || series[0][0] > t) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (series[mid][0] <= t) lo = mid;
    else hi = mid - 1;
  }
  return series[lo][1];
}

async function names() {
  const file = join(DIR, "l10n-ko.txt");
  if (!existsSync(file) || Date.now() - statSync(file).mtimeMs > 86_400_000) {
    const url = (await get("/v1/l10n/Korean"))?.data?.l10Path;
    if (url) {
      const res = await fetch(url, { headers: { "user-agent": "agent-local" } });
      if (res.ok) writeFileSync(file, await res.text());
    }
  }
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  const ko = (prefix) => new Map([...text.matchAll(new RegExp(`^${prefix}/([^┃\\r\\n]+)┃([^\\r\\n]*)`, "gm"))].map((m) => [m[1], m[2].trim()]));
  const charKo = ko("Character/Name");
  const typeKo = ko("MasteryType");
  const roleKo = ko("CharArchetype");
  const traitKo = ko("Trait/Name");
  const skillKo = ko("Skill/Group/Name");
  // 전술 스킬 그룹 이름은 시작 스킬 코드의 천 단위 그룹 번호로 찾음. 120은 아이콘 번호에 이름이 없음
  const sets = new Map(((await get("/v2/data/TacticalSkillSet"))?.data ?? []).map((x) => [x.code, Number(x.skillCode)]));
  const tacKo = new Map(
    ((await get("/v2/data/TacticalSkillSetGroup"))?.data ?? []).map((g) => {
      const sk = sets.get(g.startCode);
      return [g.group, skillKo.get(String(Math.floor(sk / 1000) * 1000)) ?? skillKo.get(String(g.icon ?? "").split("_").pop())];
    }),
  );
  const data = (await get("/v2/data/Character"))?.data ?? [];
  const chars = new Map(data.map((c) => [c.code, c.name]));
  const roles = new Map(data.map((c) => [c.code, [c.charArcheType1, c.charArcheType2].filter((x) => roleKo.has(x)).map((x) => roleKo.get(x))]));
  return {
    char: (code) => ({ key: chars.get(code) ?? String(code), name: charKo.get(String(code)) ?? chars.get(code) ?? String(code), roles: roles.get(code) ?? [] }),
    weapon: (code) => typeKo.get(WEAPON[code]) ?? `무기 ${code}`,
    trait: (code) => traitKo.get(String(code)) ?? `특성 ${code}`,
    tac: (code) => tacKo.get(code) ?? `전술 스킬 ${code}`,
  };
}

/** 지금 1000명과 since 뒤 1000위 안에 든 적 있는 계정. 닉네임은 uid를 찾는 데만 쓰고 저장하지 않음 */
let topRanks = [];
async function accounts(s, since) {
  const top = (await get(`/v1/rank/top/${s.id}/3/10`))?.topRanks ?? [];
  topRanks = top;
  let book = {};
  try {
    const b = JSON.parse(readFileSync(join(BOT, "data/rank_history.json"), "utf8"));
    if (b.players?.season === s.id) book = b.players.list ?? {};
  } catch {}
  const names = new Set(top.map((x) => x.nickname));
  for (const [name, v] of Object.entries(book)) if (v[3] && v[3] * 1000 >= since) names.add(name);
  return [...names].map((name) => ({ name, uid: book[name]?.[6] ?? null }));
}

/** 경기 기록 한 사람분을 행으로 넣고 넣은 행 수를 돌려줌 */
function insertGame(s, y, cuts, player) {
  if (y.matchingMode !== 3 || y.seasonId !== s.id) return 0;
  const who = y.nickname ? playerId(s.id, y.nickname) : player;
  if (!who) return 0;
  const t = kst(y.startDtm);
  const patch = `${s.number}.${y.versionMajor}${y.versionMinor ? `.${y.versionMinor}` : ""}`;
  const cut = cutAt(cuts, t);
  const in1000 = cut == null || y.mmrBefore == null ? null : y.mmrBefore >= Math.max(cut, RANKED_GATE) ? 1 : 0;
  const r = insertRow.run(
    y.gameId, who, s.id, t, patch, y.characterNum, y.bestWeapon, y.traitFirstCore ?? null, y.gameRank,
    y.mmrGainInGame ?? null, y.mmrLossEntryCost ?? null, y.mmrGain ?? null, y.mmrBefore ?? null,
    y.playerKill ?? null, y.damageToPlayer ?? null, y.serverName ?? null, cut, in1000,
    y.routeIdOfStart ?? null, y.tacticalSkillGroup ?? null,
  );
  return Number(r.changes);
}

/** 닉네임을 playerId로 바꿈. 11-09 원본 확인에서 닉네임을 담은 필드는 nickname과 처치자 killDetail 세 개뿐 */
function scrub(season, list) {
  const ids = new Map(list.filter((y) => y.nickname).map((y) => [y.nickname, playerId(season, y.nickname)]));
  return list.map(({ nickname, ...rest }) => {
    // 금지구역 처치는 killDetail에 지역 이름이 들어 있어 그대로 둠. 기록이 빠진 참가자에게 처치된 경우도 바꿈
    for (const [k, d] of [["killer", "killDetail"], ["killer2", "killDetail2"], ["killer3", "killDetail3"]]) {
      if (rest[k] === "player" && typeof rest[d] === "string" && rest[d]) rest[d] = ids.get(rest[d]) ?? playerId(season, rest[d]);
    }
    return { player: nickname ? ids.get(nickname) : null, ...rest };
  });
}

function pack(value) {
  const json = Buffer.from(JSON.stringify(value));
  return brotliCompressSync(json, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9, [zlib.BROTLI_PARAM_SIZE_HINT]: json.length } });
}

function saveRaw(s, game, list) {
  putRaw.run(game, s.id, list[0] ? kst(list[0].startDtm) : 0, list.length, pack(scrub(s.id, list)));
}

/** recommend 응답에서 routes 표 값을 고름. traitCodes 첫 값이 핵심 특성 */
function keepRoute(id, w) {
  let trait = null;
  try {
    trait = JSON.parse(w?.traitCodes ?? "[]")[0] ?? null;
  } catch {
    trait = null;
  }
  const nick = w?.userNickname || null;
  putRoute.run(id, nick ? playerId(0, nick) : null, w?.version ?? null, Date.now(), w?.title || null, nick, trait, w?.tacticalSkillGroupCode ?? null);
}

/** 루트의 recommend 응답을 한 번만 받아 raw.routes에 남김. only가 없으면 rows에 나온 루트 전부. userNum은 영구 계정 번호라 빼고 저장 */
async function fetchRoutes(s, only) {
  // TIER_ROUTE_MAX는 사본 DB로 시험할 때 받을 루트 수를 줄이는 값
  const queue = (only ? only.filter((id) => !hasRawRoute.get(id)) : openRoutes.all(s.id).map((r) => r.route)).slice(0, Number(process.env.TIER_ROUTE_MAX) || undefined);
  const total = queue.length;
  let saved = 0;
  const workers = Array.from({ length: Math.max(4, Math.ceil(pace.rps)) }, async () => {
    while (!abort) {
      const id = queue.shift();
      if (id == null) return;
      const r = await get(`/v1/weaponRoutes/recommend/${id}`);
      // 본문 code가 200이 아닌 일시 오류는 저장하지 않아 다음 회차에 다시 받음
      if (r === undefined || (r && r.code !== 200)) continue;
      const w = r?.result?.recommendWeaponRoute ? { ...r.result.recommendWeaponRoute } : null;
      if (w) delete w.userNum;
      putRawRoute.run(id, Date.now(), pack({ route: w, desc: r?.result?.recommendWeaponRouteDesc ?? null }));
      // 지워진 루트는 다시 받지 않게 원본만 남기고 예전 작성자 행은 그대로 둠
      if (w) keepRoute(id, w);
      saved++;
    }
  });
  await Promise.all(workers);
  if (total) log(`루트 ${total}개 가운데 ${saved}개의 정보를 저장했습니다`);
  return saved;
}

/** rows에 있고 raw에 없는 경기를 받아 원본을 남김. 상위 1,000명이 참가한 경기는 빠진 참가자 행도 넣고, 있던 행은 루트와 전술 스킬을 채움 */
async function fillGames(s, cuts) {
  // TIER_FILL_MAX는 사본 DB로 시험할 때 받을 경기 수를 줄이는 값
  const since = Math.max(s.start, Date.now() - KEEP_DAYS * 86_400_000);
  const queue = openGames.all(s.id, since).slice(0, Number(process.env.TIER_FILL_MAX) || undefined);
  const total = queue.length;
  let added = 0;
  let saved = 0;
  const workers = Array.from({ length: Math.max(4, Math.ceil(pace.rps)) }, async () => {
    while (!abort) {
      const x = queue.shift();
      if (!x) return;
      const g = await get(`/v1/games/${x.game}`);
      if (g === undefined) continue;
      const list = g?.userGames ?? [];
      if (x.top) for (const y of list) added += insertGame(s, y, cuts, null);
      for (const y of list) if (y.nickname) fillRoute.run(y.routeIdOfStart ?? null, y.tacticalSkillGroup ?? null, x.game, playerId(s.id, y.nickname));
      saveRaw(s, x.game, list);
      saved++;
    }
  });
  await Promise.all(workers);
  if (!abort) {
    for (const r of shortGames.all(s.id, since, s.id)) for (const y of JSON.parse(brotliDecompressSync(r.body))) added += insertGame(s, y, cuts, y.player);
  }
  log(`경기 ${total}개 가운데 ${saved}개의 원본을 저장했고, 상위 1,000명 경기에서 빠진 참가자 ${added}행을 추가했습니다`);
  return { games: total, saved, added };
}

/** API 없이 raw만 읽어 route와 tac이 빈 행을 채움 */
function rebuild() {
  let n = 0;
  db.exec("BEGIN");
  for (const r of db.prepare(`SELECT game, body FROM raw.games`).iterate()) {
    for (const y of JSON.parse(brotliDecompressSync(r.body))) if (y.player) n += Number(fillRoute.run(y.routeIdOfStart ?? null, y.tacticalSkillGroup ?? null, r.game, y.player).changes);
  }
  let r = 0;
  for (const x of db.prepare(`SELECT route, body FROM raw.routes`).iterate()) {
    const w = JSON.parse(brotliDecompressSync(x.body)).route;
    if (!w) continue;
    keepRoute(x.route, w);
    r++;
  }
  db.exec("COMMIT");
  log(`raw에서 루트와 전술 스킬 ${n}행, 루트 정보 ${r}개를 채웠습니다`);
}

async function collectAccount(s, acc, since, cuts, stop) {
  let uid = acc.uid;
  if (!uid) uid = (await get(`/v1/user/nickname?query=${encodeURIComponent(acc.name)}`))?.user?.userId;
  if (!uid) return 0;
  const player = playerId(s.id, acc.name);
  const newest = getAccount.get(player)?.newest ?? 0;
  let path = `/v1/user/games/uid/${uid}`;
  let added = 0;
  let top = newest;
  let complete = false;
  for (let page = 0; !abort && !stop(); page++) {
    if (page === MAX_PAGES) {
      complete = true;
      break;
    }
    const g = await get(path);
    if (g === undefined) break;
    const list = g?.userGames ?? [];
    let done = !g?.next || !list.length;
    for (const y of list) {
      const t = kst(y.startDtm);
      if (t < since || (!BACKFILL && t <= newest)) {
        done = true;
        break;
      }
      top = Math.max(top, t);
      added += insertGame(s, y, cuts, player);
    }
    if (done) {
      complete = true;
      break;
    }
    path = `/v1/user/games/uid/${uid}?next=${g.next}`;
  }
  // 중간에 끊긴 계정은 다음 실행에서 처음부터 다시 받음
  putAccount.run(player, complete ? top : newest, Date.now());
  return added;
}

/** 일꾼 여럿이 계정 목록을 나눠 받음. measure면 단계마다 속도를 올리고 첫 429에서 멈춤 */
async function collect(s, since, { measure }) {
  const cuts = cutSeries(s.id);
  const list = await accounts(s, since);
  log(`계정 ${list.length}명, 기간 시작 ${new Date(since).toISOString()}`);
  const queue = [...list];
  let added = 0;
  const result = { steps: [], limit: null, rps: pace.rps };
  let measuring = measure;
  const stopWorkers = () => false;
  const workers = Array.from({ length: measure ? STEPS.at(-1) : Math.max(4, Math.ceil(pace.rps)) }, async () => {
    while (!abort) {
      const acc = queue.shift();
      if (!acc) {
        if (!measuring) return;
        const again = list[Math.floor(Math.random() * list.length)];
        if (again.uid) await get(`/v1/user/games/uid/${again.uid}`);
        else await sleep(200);
        continue;
      }
      const n = await collectAccount(s, acc, since, cuts, stopWorkers);
      added += n;
    }
  });
  if (measure) {
    for (const rps of STEPS) {
      if (abort) break;
      pace.set(rps);
      const before = { ...stats, lat: stats.lat.length };
      const t0 = Date.now();
      await sleep(STEP_MS);
      const step = {
        rps,
        sent: stats.sent - before.sent,
        limited: stats.limited - before.limited,
        failed: stats.failed - before.failed,
        achieved: Math.round(((stats.sent - before.sent) / (Date.now() - t0)) * 10000) / 10,
        p50: median(stats.lat.slice(before.lat)),
      };
      result.steps.push(step);
      log("한도 측정", JSON.stringify(step));
      if (step.limited) break;
      result.limit = rps;
    }
    measuring = false;
    const safe = result.limit ? Math.floor(result.limit * 0.7) : 2;
    pace.set(safe);
    result.rps = safe;
    log(`측정 끝, 429 응답이 없던 최고 단계 ${result.limit ?? "없음"}, 수집 속도 초당 ${safe}회`);
    writeFileSync(RATE, JSON.stringify({ at: Date.now(), limit: result.limit, rps: safe, steps: result.steps }));
  }
  await Promise.all(workers);
  const lobbies = measure || abort ? null : await fillGames(s, cuts);
  if (!measure && !abort) await fetchRoutes(s);
  return { added: added + (lobbies?.added ?? 0), accounts: list.length, lobbies, ...result };
}

function median(a) {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
}

function patchKey(p) {
  return p.split(".").map(Number);
}

function cmpPatch(a, b) {
  const x = patchKey(a);
  const y = patchKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

// 상위 1,000명이 한 명이라도 참가한 경기는 참가자 전원을 씀
const selectRows = db.prepare(`SELECT game, player, char, weapon, rank, gain_in AS gain, mmr_before AS mmr, t, patch, in1000, route, tac, trait, gain AS net FROM rows
  WHERE season = ? AND server = ? AND gain_in IS NOT NULL AND mmr_before IS NOT NULL AND t >= ?
  AND game IN (SELECT game FROM rows WHERE season = ? AND in1000 = 1) ORDER BY t`);

/** 상위 1,000명 행을 루트, 특성, 전술 스킬별로 나눔. [코드, 플레이어 수, 판 수, 평균 RP 획득] */
function split(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!k) continue;
    let g = m.get(k);
    if (!g) m.set(k, (g = { n: 0, sum: 0, got: 0, players: new Set() }));
    g.n++;
    g.players.add(r.player);
    if (r.net != null) {
      g.sum += r.net;
      g.got++;
    }
  }
  return [...m].map(([code, g]) => [code, g.players.size, g.n, g.got ? round(g.sum / g.got, 1) : null]);
}

// 판의 1% 미만인 특성과 전술 스킬은 화면에 넣지 않음
const MIN_SHARE = 0.01;

function detail(rows, nm) {
  if (!rows.length) return {};
  const keep = (list, name) =>
    list
      .filter((x) => x[2] / rows.length >= MIN_SHARE)
      .sort((a, b) => b[2] - a[2] || b[1] - a[1])
      .map(([code, ...rest]) => [name(code), ...rest, code]);
  return {
    dn: rows.length,
    routes: split(rows, "route")
      .sort((a, b) => b[1] - a[1] || b[2] - a[2])
      .slice(0, 3),
    traits: keep(split(rows, "trait"), nm.trait),
    tac: keep(split(rows, "tac"), nm.tac),
  };
}

function view(id, label, rows, nm, extra = {}, k) {
  const r = scoreRows(rows, k ? { ...RULE, k } : RULE);
  if (!r) return null;
  const top = new Map();
  for (const x of rows) {
    if (x.in1000 !== 1) continue;
    const key = `${x.char}:${x.weapon}`;
    if (!top.has(key)) top.set(key, []);
    top.get(key).push(x);
  }
  return {
    id,
    label,
    from: rows[0].t,
    to: rows.at(-1).t,
    rows: r.rows,
    games: r.games,
    base: round(r.base, 1),
    k: Math.round(r.k),
    ks: Object.fromEntries(Object.entries(r.ks).map(([m, v]) => [m, Math.round(v)])),
    ...extra,
    combos: r.combos.map((c) => ({
      char: c.char,
      ...nm.char(c.char),
      weapon: c.weapon,
      weaponName: nm.weapon(c.weapon),
      grade: c.grade,
      score: round(c.score, 1),
      half: round(c.half, 1),
      raw: round(c.raw, 1),
      z: round(c.z, 2),
      n: c.n,
      players: c.players,
      top: round(c.top, 2),
      ep: round(c.ep, 1),
      place: round(c.place, 2),
      top3: round(c.top3 * 100, 1),
      win: round(c.win * 100, 1),
      pick: round(c.pick * 100, 2),
      ...detail(top.get(`${c.char}:${c.weapon}`) ?? [], nm),
    })),
  };
}

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function writeTier(data) {
  for (const dir of [OUT, DIR]) {
    mkdirSync(dir, { recursive: true });
    const tmp = join(dir, `.tier.json.${process.pid}`);
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, join(dir, "tier.json"));
  }
}

// 28일 탭이 패치가 바뀐 뒤에도 남도록 패치 대신 날짜로 지움
const KEEP_DAYS = 35;
const prune = db.prepare(`DELETE FROM rows WHERE season <> ? OR t < ?`);

/** 화면에 올라가는 루트의 이름, 작성자, 핵심 특성, 전술 스킬과 지금 순위로 정한 작성자 배지 */
async function routeMeta(s, ids, nm) {
  const top = topRanks.length ? topRanks : ((await get(`/v1/rank/top/${s.id}/3/10`))?.topRanks ?? []);
  // 루트는 시즌을 넘어 쓰이므로 작성자 키에 시즌을 넣지 않음
  const rank = new Map(top.map((x) => [playerId(0, x.nickname), x.rank]));
  const badge = new Map();
  const info = {};
  for (const id of ids) {
    const r = getRoute.get(id);
    // 원본은 있는데 routes 행이 없으면 recommend가 404였던 루트. 화면이 아직 받지 않은 루트와 구분하도록 빈 값을 둠
    if (!r) {
      if (hasRawRoute.get(id)) info[id] = [null, null, null, null, null, null];
      continue;
    }
    const at = r.author ? (rank.get(r.author) ?? null) : null;
    rankRoute.run(at, id);
    const b = at == null ? null : AUTHOR_BADGE.find(([max]) => at <= max)?.[1];
    if (b) badge.set(id, b);
    info[id] = [r.title, r.nick, r.trait, r.trait ? nm.trait(r.trait) : null, r.tac, r.tac ? nm.tac(r.tac) : null];
  }
  return { badge, info };
}

async function publish(s, nm) {
  const now = Date.now();
  const lastFile = join(DIR, "tier.json");
  const last = existsSync(lastFile) ? JSON.parse(readFileSync(lastFile, "utf8")) : null;
  const all = s.regular ? selectRows.all(s.id, SERVER, s.start, s.id) : [];
  // 프리 시즌과 새 시즌 첫 집계 전에는 마지막 표를 그대로 두고 상태만 바꿈
  if (!all.length) {
    if (last) writeTier({ ...last, state: "offseason", updatedAt: now, next: s.regular && last.season?.id !== s.id ? s.name : undefined });
    log("집계할 행이 없어 마지막 표를 유지합니다.");
    return;
  }
  // 새 시즌 첫 집계 때 지난 시즌 마지막 표의 패치 탭만 남김. 한 시즌 전까지만 둠
  const past = last && last.season?.id !== s.id ? { season: last.season, views: last.views.filter((v) => v.id.startsWith("patch-")) } : last?.past;
  const patches = [...new Set(all.map((r) => r.patch))].sort(cmpPatch);
  const cur = patches.at(-1);
  const views = [];
  for (const p of patches.slice(-2).reverse()) {
    const rows = all.filter((r) => r.patch === p);
    const ready = rows.length >= PUBLISH_ROWS;
    if (p !== cur && !ready) continue;
    // 가장 오래된 패치는 수집 시작 뒤 경기만 있음
    const partial = p === patches[0] && rows[0].t > s.start + 86_400_000;
    const v = view(`patch-${p}`, `${p} 패치`, rows, nm, { patch: p, ready, ...(partial && { partial }) });
    if (v) views.push(v);
  }
  for (const d of SPANS) {
    const since = now - d * 86_400_000;
    if (all[0].t > since) continue;
    const rows = all.filter((r) => r.t >= since);
    const ps = [...new Set(rows.map((r) => r.patch))].sort(cmpPatch);
    const v = view(`${d}d`, `최근 ${d}일`, rows, nm, { patch: cur, days: d, ...(ps.length > 1 && { patches: ps }) });
    if (v) views.push(v);
  }
  const curRows = all.filter((r) => r.patch === cur);
  // 짧은 기간은 조합 사이 분산을 추정하기에 표본이 적어 패치 전체의 지표별 k를 씀
  const k = views.find((v) => v.id === `patch-${cur}`)?.ks;
  for (const d of WINDOWS) {
    // 패치가 d일보다 짧으면 패치 탭과 같은 행이라 만들지 않음
    if (!curRows.length || curRows[0].t >= now - d * 86_400_000) continue;
    const rows = curRows.filter((r) => r.t >= now - d * 86_400_000);
    const v = view(`${d}d`, `최근 ${d}일`, rows, nm, { patch: cur, days: d }, k);
    if (v) views.push(v);
  }
  const ids = [...new Set([...views, ...(past?.views ?? [])].flatMap((v) => v.combos.flatMap((c) => (c.routes ?? []).map((x) => x[0]))))];
  // --publish나 중단된 회차 뒤에도 화면에 오를 루트는 정보를 갖추게 함. 수집 회차에서는 이미 받아 요청이 없음
  if (!abort) await fetchRoutes(s, ids);
  const { badge, info } = await routeMeta(s, ids, nm);
  for (const v of views) for (const c of v.combos) for (const x of c.routes ?? []) if (badge.has(x[0])) x.push(badge.get(x[0]));
  const ready = views.find((v) => v.patch === cur && v.id.startsWith("patch-"))?.ready;
  const state = !s.regular || now >= s.end ? "offseason" : ready ? "shown" : "collecting";
  const cuts = cutSeries(s.id);
  const data = {
    version: 1,
    updatedAt: now,
    season: { id: s.id, name: s.name, end: s.end },
    state,
    patch: cur ?? null,
    band: { name: "in1000", server: "아시아1", floor: RANKED_GATE, cut: cuts.at(-1)?.[1] ?? null },
    rule: { ...RULE, publishRows: PUBLISH_ROWS },
    rate: existsSync(RATE) ? JSON.parse(readFileSync(RATE, "utf8")) : undefined,
    views,
    routes: info,
    ...(past && { past }),
  };
  writeTier(data);
  const removed = prune.run(s.id, now - KEEP_DAYS * 86_400_000).changes;
  log(`집계 ${state}, ${views.map((v) => `${v.label} ${v.rows}행`).join(", ")}${removed ? `, ${KEEP_DAYS}일 지난 행 ${removed}개 삭제` : ""}`);
}

async function once(measure) {
  abort = null;
  const startedAt = Date.now();
  const unwatch = watchBot(startedAt, measure ? 10_000 : 30_000);
  try {
    const s = await season();
    if (!s) throw new Error("현재 시즌을 찾지 못했습니다.");
    const nm = await names();
    let run = null;
    if (s.regular && Date.now() < s.end && !PUBLISH_ONLY) {
      const since = Math.max(s.start, Date.now() - opt("days", 11) * 86_400_000);
      run = await collect(s, since, { measure });
      log(`새 행 ${run.added}, 요청 ${stats.sent}, 한도 응답 ${stats.limited}, 실패 ${stats.failed}, ${Math.round((Date.now() - startedAt) / 1000)}초`);
      writeFileSync(join(DIR, "status.json"), JSON.stringify({ at: Date.now(), abort, ...run, stats: { ...stats, lat: undefined } }));
    }
    if (!abort) await publish(s, nm);
  } finally {
    unwatch();
  }
  return !abort;
}

if (flag("rebuild")) {
  rebuild();
  process.exit(0);
}

const every = opt("every", 0);
let first = true;
for (;;) {
  const ok = await once(first && flag("measure"));
  first = false;
  if (!ok || flag("once") || !every) break;
  await sleep(every * 60_000);
}
if (abort) process.exitCode = 3;
