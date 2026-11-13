// 아시아1 in1000 경기 기록 수집과 티어 집계. 호스트에서 실행, 원시 행은 TIER_DIR SQLite, 집계는 TIER_OUT/tier.json
// 사용: node scripts/er/tier/collect.mjs [--measure] [--rps 10] [--days 7] [--every 180] [--once] [--rebuild]
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { brotliCompressSync, brotliDecompressSync, constants as zlib } from "node:zlib";
import { dakStopped } from "./dakstop.mjs";
import { derive, writeDerived } from "./derive.mjs";
import { derivePre, writePre } from "./preseason.mjs";
import { LOBBY, RULE, scoreRows } from "./score.mjs";
import { topView, writeTop } from "./top.mjs";

const HOME = homedir();
const DIR = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
const OUT = process.env.TIER_OUT || join(HOME, "docker/_data/labs/er-tier");
const BOT = process.env.BOT_DIR || join(HOME, "docker/mongsil-bot");
// TIER_API는 사본 DB 시험에서 가짜 서버를 쓰려고 바꾸는 값
const API = process.env.TIER_API || "https://open-api.bser.io";
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
    server TEXT, cut INTEGER, in1000 INTEGER, route INTEGER, tac INTEGER, assists INTEGER, deaths INTEGER, monsters INTEGER,
    PRIMARY KEY (game, player)
  );
  CREATE INDEX IF NOT EXISTS rows_t ON rows (season, t);
  CREATE TABLE IF NOT EXISTS accounts (player TEXT PRIMARY KEY, newest INTEGER, checked INTEGER);
  CREATE TABLE IF NOT EXISTS routes (route INTEGER PRIMARY KEY, author TEXT, author_rank INTEGER, version TEXT, checked INTEGER);
`);
// route와 tac은 11-09, 경기 지표 세 열은 11-10에 더한 열. 기존 행은 --rebuild가 raw에서 채움
const rowCols = new Set(db.prepare(`PRAGMA table_info(rows)`).all().map((c) => c.name));
for (const c of ["route", "tac", "assists", "deaths", "monsters"]) if (!rowCols.has(c)) db.exec(`ALTER TABLE rows ADD COLUMN ${c} INTEGER`);
// mmr은 11-12에 더한 열. 마지막으로 경기 목록을 끝까지 받은 회차의 rank/top RP이고, 다음 회차 RP가 같으면 그 계정은 요청하지 않음
if (!db.prepare(`PRAGMA table_info(accounts)`).all().some((c) => c.name === "mmr")) db.exec(`ALTER TABLE accounts ADD COLUMN mmr INTEGER`);
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
// recommend가 404인 루트를 dak.gg에서 받은 값. 모든 칸이 null인 행은 dak.gg에도 없던 루트라 다시 묻지 않음
db.exec(`CREATE TABLE IF NOT EXISTS dak_routes (route INTEGER PRIMARY KEY, t INTEGER NOT NULL, title TEXT, nick TEXT, trait INTEGER, tac INTEGER)`);
// body는 11-12에 더한 dak.gg weaponRoute 원본(userNum 뺌). 이 열이 빈 옛 행은 아이템과 지역을 받으려고 한 번 다시 물음
if (!db.prepare(`PRAGMA table_info(dak_routes)`).all().some((c) => c.name === "body")) db.exec(`ALTER TABLE dak_routes ADD COLUMN body BLOB`);
const insertRow = db.prepare(`INSERT OR IGNORE INTO rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const fillRow = db.prepare(`UPDATE rows SET route = coalesce(route, ?), tac = coalesce(tac, ?), assists = coalesce(assists, ?), deaths = coalesce(deaths, ?), monsters = coalesce(monsters, ?)
  WHERE game = ? AND player = ? AND (route IS NULL OR assists IS NULL)`);
/** 원본 한 사람분으로 뒤에 더한 열이 빈 행을 채우고 바뀐 행 수를 돌려줌 */
const fill = (y, game, player) =>
  Number(fillRow.run(y.routeIdOfStart ?? null, y.tacticalSkillGroup ?? null, y.playerAssistant ?? null, y.playerDeaths ?? null, y.monsterKill ?? null, game, player).changes);
const getAccount = db.prepare(`SELECT newest, checked, mmr FROM accounts WHERE player = ?`);
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
const getRawRoute = db.prepare(`SELECT body FROM raw.routes WHERE route = ?`);
const getDak = db.prepare(`SELECT title, nick, trait, tac, body FROM dak_routes WHERE route = ?`);
const putDak = db.prepare(`INSERT OR REPLACE INTO dak_routes (route, t, title, nick, trait, tac, body) VALUES (?, ?, ?, ?, ?, ?, ?)`);
const markDak = db.prepare(`UPDATE dak_routes SET t = ?, body = ? WHERE route = ?`);
const rankRoute = db.prepare(`UPDATE routes SET author_rank = ? WHERE route = ?`);
const putAccount = db.prepare(`INSERT INTO accounts (player, newest, checked, mmr) VALUES (?,?,?,?) ON CONFLICT(player) DO UPDATE SET newest = max(coalesce(newest, 0), excluded.newest), checked = excluded.checked, mmr = excluded.mmr`);

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

const stats = { sent: 0, ok: 0, limited: 0, failed: 0, skipped: 0, lat: [] };
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
  const prev = list.filter((x) => x.seasonName.startsWith("Season") && x.seasonID < cur.seasonID).at(-1);
  const before = list.filter((x) => x.seasonID < cur.seasonID).at(-1);
  return {
    // 정규 시즌으로 넘어간 뒤에도 직전 프리 시즌의 마지막 구간을 조회하려고 남김
    pre: before && !before.seasonName.startsWith("Season") ? { id: before.seasonID, prev: prev?.seasonID ?? null, regular: false, name: `프리 시즌 ${Number(before.seasonName.replace(/\D/g, "")) - SEASON_NAME_OFFSET}`, start: kst(`${before.seasonStart}+0900`), end: kst(`${before.seasonEnd}+0900`) } : null,
    id: cur.seasonID,
    prev: prev?.seasonID ?? null,
    regular: cur.seasonName.startsWith("Season"),
    name: cur.seasonName.startsWith("Season") ? `정규 시즌 ${n}` : `프리 시즌 ${n}`,
    number: n,
    start: kst(`${cur.seasonStart}+0900`),
    end: kst(`${cur.seasonEnd}+0900`),
  };
}

/** 매시 순위 스냅숏의 place위 RP. [시각 ms, RP] 오름차순 */
function cutSeries(seasonId, place = 1000) {
  const out = [];
  for (const line of readFileSync(join(BOT, "data/rank_snapshots.jsonl"), "utf8").split("\n")) {
    if (!line) continue;
    const s = JSON.parse(line);
    if (s.s !== seasonId || !Array.isArray(s.rp) || s.rp.length < 1000) continue;
    out.push([s.t * 1000, [...s.rp].sort((a, b) => b - a)[place - 1]]);
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
  const itemKo = ko("Item/Name");
  const areaKo = ko("Area/Name");
  const stateKo = ko("CharacterState/Group/Name");
  const weatherKo = ko("Weather/Name");
  const areas = new Map(((await get("/v2/data/Area"))?.data ?? []).map((a) => [a.code, areaKo.get(a.name) ?? a.name]));
  // 루트 아이템 칸의 바탕색에 쓰는 등급
  const grades = new Map();
  for (const t of ["ItemWeapon", "ItemArmor"]) for (const x of (await get(`/v2/data/${t}`))?.data ?? []) grades.set(x.code, x.itemGrade ?? null);
  // preseason.mjs를 직접 실행할 때 API 없이 방어구 등급을 찾도록 남김
  if (grades.size) writeFileSync(join(DIR, "item-grades.json"), JSON.stringify(Object.fromEntries(grades)));
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
    item: (code) => [itemKo.get(String(code)) ?? `아이템 ${code}`, grades.get(code) ?? null],
    area: (code) => areas.get(code) ?? `지역 ${code}`,
    // 가젯과 루미 지급품은 기록 코드의 백 단위 그룹 번호로 이름을 찾음
    skill: (code) => skillKo.get(String(Math.floor(code / 100) * 100)) ?? `가젯 ${code}`,
    state: (code) => stateKo.get(String(Math.floor(code / 100) * 100)) ?? `버프 ${code}`,
    weather: (code) => weatherKo.get(String(code)) ?? `날씨 ${code}`,
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
  const mmr = new Map(top.map((x) => [x.nickname, x.mmr == null ? null : Number(x.mmr)]));
  const names = new Set(mmr.keys());
  for (const [name, v] of Object.entries(book)) if (v[3] && v[3] * 1000 >= since) names.add(name);
  return [...names].map((name) => ({ name, uid: book[name]?.[6] ?? null, mmr: mmr.get(name) ?? null }));
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
    y.routeIdOfStart ?? null, y.tacticalSkillGroup ?? null, y.playerAssistant ?? null, y.playerDeaths ?? null, y.monsterKill ?? null,
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

/** 루트 응답의 traitCodes 첫 값이 핵심 특성 */
function firstTrait(w) {
  try {
    return JSON.parse(w?.traitCodes ?? "[]")[0] ?? null;
  } catch {
    return null;
  }
}

/** recommend 응답에서 routes 표 값을 고름 */
function keepRoute(id, w) {
  const nick = w?.userNickname || null;
  putRoute.run(id, nick ? playerId(0, nick) : null, w?.version ?? null, Date.now(), w?.title || null, nick, firstTrait(w), w?.tacticalSkillGroupCode ?? null);
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

const DAK_API = process.env.TIER_DAK_API || "https://er.dakgg.io/api/v1/routes";
// 이 파일이 있으면 적힌 시각까지 dak.gg에 요청하지 않음. dak.gg가 거절하면 하루 뒤 시각으로 만듦
const DAK_STOP = join(DIR, "dak-stopped");
const DAK_STOP_MS = 86_400_000;
const DAK_GAP_MS = 3000;
// 한 회차에 dak.gg에 보내는 요청 수 상한. 남은 루트는 다음 회차가 이어 받음
const DAK_MAX = 20;

/** 화면 루트 가운데 recommend가 404였던 것만 dak.gg에 하나씩 물어 이름, 작성자, 특성, 전술 스킬, 목표 아이템, 지역을 남김. 좋아요나 승률 같은 수치는 쓰지 않음 */
async function fetchDak(ids) {
  const queue = ids.filter((id) => {
    const d = getDak.get(id);
    // 본문을 받았거나 dak.gg에도 없던 루트(모든 칸 null)는 다시 묻지 않음
    if (d && (d.body || [d.title, d.nick, d.trait, d.tac].every((v) => v == null))) return false;
    const r = getRawRoute.get(id);
    return !!r && JSON.parse(brotliDecompressSync(r.body)).route == null;
  }).slice(0, DAK_MAX);
  if (!queue.length) return;
  if (dakStopped(existsSync(DAK_STOP) ? readFileSync(DAK_STOP, "utf8") : null, Date.now())) {
    log(`dak-stopped 파일이 있어 루트 ${queue.length}개를 dak.gg에 요청하지 않습니다`);
    return;
  }
  let saved = 0;
  let asked = 0;
  for (const id of queue) {
    if (abort) break;
    if (asked++) await sleep(DAK_GAP_MS);
    let res;
    try {
      res = await fetch(`${DAK_API}?id=${id}`, { headers: { "user-agent": "agent-local" }, signal: AbortSignal.timeout(20_000) });
    } catch (e) {
      log("dak.gg 요청 실패", e.message);
      break;
    }
    // 한도나 서버 오류면 멈추고 남은 루트는 하루 뒤 회차부터 요청함
    if (res.status !== 200 && res.status !== 404) {
      writeFileSync(DAK_STOP, new Date(Date.now() + DAK_STOP_MS).toISOString());
      log(`dak.gg가 ${res.status}로 응답해 하루 동안 루트 이름 수집을 멈춥니다`);
      break;
    }
    let w = null;
    if (res.status === 200) {
      try {
        w = (await res.json())?.weaponRoute ?? null;
      } catch (e) {
        log("dak.gg 응답을 읽지 못했습니다", e.message);
        break;
      }
      // 404가 아닌데 루트가 비어 있으면 형식이 바뀌었을 수 있어 저장하지 않고 다음 회차에 다시 물음
      if (!w) continue;
    }
    // 이름만 받아 둔 루트가 그 사이 dak.gg에서 지워졌으면 받아 둔 값은 두고 본문 칸에 null을 넣어 다시 묻지 않음
    if (!w && getDak.get(id)) {
      markDak.run(Date.now(), pack(null), id);
      continue;
    }
    const body = w ? { ...w } : null;
    if (body) delete body.userNum;
    putDak.run(id, Date.now(), w?.title || null, w?.userNickname || null, firstTrait(w), w?.tacticalSkillGroupCode ?? null, body ? pack(body) : null);
    saved++;
  }
  log(`dak.gg에 루트 ${queue.length}개의 정보를 요청해 ${saved}개를 저장했습니다`);
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
      for (const y of list) if (y.nickname) fill(y, x.game, playerId(s.id, y.nickname));
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

/** API 없이 raw만 읽어 route, tac, 경기 지표가 빈 행을 채움 */
function rebuild() {
  let n = 0;
  db.exec("BEGIN");
  for (const r of db.prepare(`SELECT game, body FROM raw.games`).iterate()) {
    for (const y of JSON.parse(brotliDecompressSync(r.body))) if (y.player) n += fill(y, r.game, y.player);
  }
  let r = 0;
  for (const x of db.prepare(`SELECT route, body FROM raw.routes`).iterate()) {
    const w = JSON.parse(brotliDecompressSync(x.body)).route;
    if (!w) continue;
    keepRoute(x.route, w);
    r++;
  }
  db.exec("COMMIT");
  log(`raw에서 루트, 전술 스킬, 경기 지표 ${n}행과 루트 정보 ${r}개를 채웠습니다`);
}

async function collectAccount(s, acc, since, cuts, stop, measure) {
  const player = playerId(s.id, acc.name);
  const prev = getAccount.get(player);
  // 랭크 경기를 하면 RP가 바뀌므로 지난번에 끝까지 받은 뒤 RP가 같은 계정은 건너뜀. 순 변화가 0인 판을 놓치지 않게 하루에 한 번은 받음
  // 종료 뒤에는 수집하지 않아 늦게 반영된 판을 되찾을 수 없으므로 시즌 마지막 하루는 건너뛰지 않음
  if (!BACKFILL && !measure && s.end - Date.now() > 86_400_000 && acc.mmr != null && prev?.mmr === acc.mmr && prev.checked > Date.now() - 86_400_000) {
    stats.skipped++;
    return 0;
  }
  let uid = acc.uid;
  if (!uid) uid = (await get(`/v1/user/nickname?query=${encodeURIComponent(acc.name)}`))?.user?.userId;
  if (!uid) return 0;
  const newest = prev?.newest ?? 0;
  let path = `/v1/user/games/uid/${uid}`;
  let added = 0;
  let top = newest;
  let complete = false;
  // 마지막 랭크 경기 뒤 RP. rank/top RP와 같을 때만 저장해, 목록에 아직 안 올라온 판이 있으면 다음 회차에 다시 받음
  let after;
  for (let page = 0; !abort && !stop(); page++) {
    if (page === MAX_PAGES) {
      complete = true;
      break;
    }
    const g = await get(path);
    if (g === undefined) break;
    const list = g?.userGames ?? [];
    if (page === 0) after = Number(list.find((y) => y.matchingMode === 3 && y.seasonId === s.id)?.mmrAfter);
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
  // 중간에 끊긴 계정은 다음 실행에서 처음부터 다시 받음. checked와 mmr도 끝까지 받았을 때만 바꿈
  const ok = complete && acc.mmr != null && after === acc.mmr;
  putAccount.run(player, complete ? top : newest, complete ? Date.now() : (prev?.checked ?? 0), ok ? acc.mmr : complete ? null : (prev?.mmr ?? null));
  return added;
}

/** 경기 번호 id부터 위로 열 개 안에서 처음 조회되는 경기의 시작 시각. 없으면 null */
async function gameAt(id) {
  for (let k = 0; k < 10 && !abort; k++) {
    const y = (await get(`/v1/games/${id + k}`))?.userGames?.[0];
    if (y) return { id: id + k, t: kst(y.startDtm) };
  }
  return null;
}

/** lo와 hi 사이에서 시작 시각이 t 이하인 마지막 경기 번호 */
async function idBefore(t, lo, hi) {
  while (hi - lo > 20 && !abort) {
    const mid = Math.floor((lo + hi) / 2);
    const g = await gameAt(mid);
    if (g && g.t <= t) lo = g.id;
    else hi = mid;
  }
  return lo;
}

/**
 * 프리 시즌의 모든 경기를 경기 번호 순서대로 빠짐없이 조회해 13.0 신규 기능 필드만 preseason.sqlite에 모음.
 * 프리 시즌 순위표가 없어 계정 대신 경기 번호로 찾음. 닉네임과 uid는 저장하지 않고, 티어 행과 경기 원본도 만들지 않음
 */
async function collectPre(s) {
  const r = await scanPre(s);
  // 기준 번호조차 못 받은 회차는 API 장애로 보고 다시 받기도 건너뜀
  return { ...r, refilled: abort || r.down ? 0 : await refillPre(s) };
}

/** 단계 기록, 가젯 횟수, 최종 장비, 크레딧을 저장하기 전에 받은 경기를 회차마다 PRE_REFILL개씩 다시 받아 채움 */
async function refillPre(s) {
  const old = pre.prepare(`SELECT DISTINCT game FROM rows WHERE season = ? AND (quest IS NULL OR equip IS NULL) ORDER BY game LIMIT ?`).all(s.id, PRE_REFILL).map((r) => r.game);
  const gone = pre.prepare(`UPDATE rows SET quest = coalesce(quest, '[]'), equip = coalesce(equip, '[]'), robot = coalesce(robot, 0) WHERE season = ? AND game = ?`);
  let j = 0, refilled = 0;
  await Promise.all(Array.from({ length: Math.max(4, Math.ceil(pace.rps)) }, async () => {
    while (!abort && j < old.length) {
      const id = old[j++];
      const body = await get(`/v1/games/${id}`);
      const list = body?.userGames ?? [];
      if (list.length) {
        if (putPre(s, id, list)) refilled++;
      } else if (body === null || body?.code === 200) {
        // 더는 조회되지 않는 경기는 빈 기록으로 두어 다음 회차가 다시 고르지 않게 함
        gone.run(s.id, id);
      }
    }
  }));
  return refilled;
}

async function scanPre(s) {
  // 같은 키를 쓰는 몽실봇 몫을 남기려고 한도 50보다 낮춤
  pace.set(Math.min(pace.rps, PRE_RPS));
  // 끝난 지 한 시간이 안 된 번호에는 아직 진행 중인 경기가 섞여 있어 다음 회차로 미룸
  const until = Math.min(Date.now() - 60 * 60_000, s.end);
  const state = pre.prepare(`SELECT hi, ids, found FROM scan WHERE season = ?`).get(s.id) ?? { hi: 0, ids: 0, found: 0 };
  // 위쪽 기준은 지난 시즌 상위권의 가장 최근 경기 번호
  let seed = 0;
  for (const x of ((await get(`/v1/rank/top/${s.prev}/3/10`))?.topRanks ?? []).slice(0, 3)) {
    const uid = (await get(`/v1/user/nickname?query=${encodeURIComponent(x.nickname)}`))?.user?.userId;
    for (const y of (uid && (await get(`/v1/user/games/uid/${uid}`))?.userGames) || []) seed = Math.max(seed, y.gameId);
  }
  const empty = { games: 0, ids: 0 };
  if (!seed) return { ...empty, down: true };
  // 처음 회차는 시즌 시작 직전 번호를 찾음. 하루 약 4만 번호가 쓰여 50만 번호 아래에서 시작함
  const lo = state.hi || (await idBefore(s.start, seed - 500_000, seed));
  // 상위권이 한동안 게임을 하지 않았으면 기준 번호가 오래돼 있어 until을 넘는 번호가 나올 때까지 위로 넓힘
  let top = seed;
  for (let step = 2000; !abort; step *= 2) {
    const g = await gameAt(top + step);
    if (!g || g.t > until) {
      top += step;
      break;
    }
    top = g.id;
  }
  // deadline이 있으면 그 3분 전까지 지금 속도로 받을 수 있는 만큼만 맡음
  const room = s.deadline ? Math.floor(((pace.rps * (s.deadline - Date.now() - 3 * 60_000)) / 1000) * 0.8) : Infinity;
  const hi = Math.min(await idBefore(until, lo, top), lo + PRE_MAX_IDS, lo + Math.max(0, room));
  if (hi <= lo || abort) return empty;
  let next = lo + 1;
  let games = 0;
  // 받지 못했거나 저장하지 못한 번호. 회차 끝에 한 번 더 시도함
  const misses = new Set();
  const take = (id, body) => {
    if (body === undefined) return false;
    const list = body?.userGames ?? [];
    // 일반 경기는 seasonId가 0이라 시작 시각으로 프리 시즌 경기를 가림
    if (!list.length || kst(list[0].startDtm) < s.start) return true;
    if (!putPre(s, id, list)) return false;
    games++;
    return true;
  };
  const workers = Array.from({ length: Math.max(4, Math.ceil(pace.rps)) }, async () => {
    while (!abort && next <= hi && !(s.deadline && Date.now() > s.deadline)) {
      const id = next++;
      if (!take(id, await get(`/v1/games/${id}`))) misses.add(id);
    }
  });
  await Promise.all(workers);
  // 누락이 많으면 장애로 보고 재시도 없이 다음 회차에 맡김
  if (misses.size <= PRE_RETRY_MAX) {
    const retry = [...misses];
    let k = 0;
    await Promise.all(Array.from({ length: Math.max(4, Math.ceil(pace.rps)) }, async () => {
      while (!abort && k < retry.length && !(s.deadline && Date.now() > s.deadline)) {
        const id = retry[k++];
        if (take(id, await get(`/v1/games/${id}`))) misses.delete(id);
      }
    }));
  }
  // 범위를 막는 가장 낮은 번호만 실패 횟수를 셈. PRE_MISS_MAX회 연속 실패하면 그 번호만 건너뜀
  let stuck = Infinity;
  if (!abort) {
    const low = [...misses].sort((x, y) => x - y);
    const n = low.length ? (pre.prepare(`SELECT n FROM miss WHERE season = ? AND id = ?`).get(s.id, low[0])?.n ?? 0) + 1 : 0;
    pre.exec("BEGIN");
    pre.prepare(`DELETE FROM miss WHERE season = ?`).run(s.id);
    if (low.length) pre.prepare(`INSERT INTO miss VALUES (?, ?, ?)`).run(s.id, low[0], n);
    pre.exec("COMMIT");
    if (n >= PRE_MISS_MAX) log(`경기 번호 ${low[0]}의 자료를 ${n}회 연속 받지 못해 건너뜁니다.`);
    stuck = (n >= PRE_MISS_MAX ? low[1] : low[0]) ?? Infinity;
  }
  // 마감으로 멈췄으면 아직 꺼내지 않은 번호부터 다음에 받음
  const done = Math.min(hi, next - 1, stuck - 1);
  if (!abort && done > lo) {
    const found = pre.prepare(`SELECT COUNT(DISTINCT game) AS n FROM rows WHERE season = ?`).get(s.id).n;
    pre.prepare(`INSERT INTO scan VALUES (?, ?, ?, ?) ON CONFLICT(season) DO UPDATE SET hi = excluded.hi, ids = excluded.ids, found = excluded.found`)
      .run(s.id, done, state.ids + done - lo, found);
  }
  return { games, ids: hi - lo };
}

const PRE_RPS = 40;
const PRE_REFILL = 10_000;
const PRE_TAIL = 6 * 3600_000;
const PRE_MISS_MAX = 3;
const PRE_RETRY_MAX = 200;
// 한 회차가 너무 길어지지 않게 조회할 번호 수의 상한. 넘으면 다음 회차가 이어서 조회함
const PRE_MAX_IDS = 40_000;
let pre = null;
let putPreRow = null;
function openPre() {
  pre = new DatabaseSync(join(DIR, "preseason.sqlite"));
  pre.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS scan (season INTEGER PRIMARY KEY, hi INTEGER NOT NULL, ids INTEGER NOT NULL, found INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rows (
      game INTEGER NOT NULL, slot INTEGER NOT NULL, season INTEGER NOT NULL, t INTEGER NOT NULL, mode INTEGER NOT NULL, server TEXT,
      team INTEGER, rank INTEGER, char INTEGER, weapon INTEGER, bot INTEGER, weather INTEGER,
      exp TEXT, exp_reward INTEGER, exp_credit INTEGER, gadgets TEXT, drops TEXT, lumi INTEGER,
      PRIMARY KEY (game, slot)
    );
    CREATE INDEX IF NOT EXISTS rows_season ON rows (season, mode);
    CREATE TABLE IF NOT EXISTS miss (season INTEGER NOT NULL, id INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (season, id));
  `);
  // 실험 과제 단계 기록, 최종 장비, 안내 로봇 크레딧은 나중에 더한 열이라 예전 행은 NULL
  for (const [col, type] of [["quest", "TEXT"], ["equip", "TEXT"], ["robot", "INTEGER"]])
    if (!pre.prepare(`SELECT 1 FROM pragma_table_info('rows') WHERE name = ?`).get(col)) pre.exec(`ALTER TABLE rows ADD COLUMN ${col} ${type}`);
  putPreRow = pre.prepare(`INSERT OR REPLACE INTO rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
}

function putPre(s, game, list) {
  pre.exec("BEGIN");
  try {
    list.forEach((y, i) => putPreOne(s, game, i, y));
    pre.exec("COMMIT");
    return true;
  } catch (e) {
    pre.exec("ROLLBACK");
    log(`프리 시즌 경기 ${game}을 저장하지 못했습니다: ${e.message}`);
    return false;
  }
}

function putPreOne(s, game, i, y) {
  const drops = Array.isArray(y.guideRobotWeatherDropPickUpCount) ? y.guideRobotWeatherDropPickUpCount.filter((d) => d.count > 0).map((d) => [d.buffCode, d.count]) : [];
  putPreRow.run(
    game, i, s.id, kst(y.startDtm), y.matchingMode, y.serverName ?? null,
    y.teamNumber ?? null, y.gameRank ?? null, y.characterNum ?? null, y.bestWeapon ?? null, y.isMLBot ? 1 : 0, y.mainWeather ?? null,
    y.experimentResultType ?? null, y.crExperimentReward ?? null, y.crExperimentalCredit ?? null,
    JSON.stringify(y.useGadget ?? {}), JSON.stringify(drops), y.guideRobotWeatherObjectCount ?? 0,
    JSON.stringify((y.questStepClear ?? []).map((q) => [q.experimentGroupId, Math.round(q.firstClearElapsedSeconds), q.clearCount])),
    // 슬롯 0~5 순서의 최종 장비 코드. 빈 슬롯은 0
    JSON.stringify([0, 1, 2, 3, 4, 5].map((k) => y.equipment?.[k] ?? 0)),
    y.crGetByGuideRobot ?? 0,
  );
}

/** 프리 시즌 특집 집계. 저장한 행만 읽고 공식 API에는 요청하지 않음 */
function publishPre(s, nm) {
  try {
    const scan = pre.prepare(`SELECT ids, found FROM scan WHERE season = ?`).get(s.id);
    const base = pre.prepare(`SELECT * FROM rows WHERE season = ? ORDER BY game, slot`).iterate(s.prev);
    const out = derivePre(pre.prepare(`SELECT * FROM rows WHERE season = ? ORDER BY game, slot`).iterate(s.id), s, nm, scan, base);
    if (out && writePre(join(OUT, ".."), out)) log(`프리 시즌 특집 집계 ${out.games}경기, 티어 ${out.tier?.combos.length ?? 0}개 조합`);
  } catch (e) {
    log(`프리 시즌 특집 집계 실패: ${e.message}`);
  }
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
      const n = await collectAccount(s, acc, since, cuts, stopWorkers, measure);
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
const selectRows = db.prepare(`SELECT game, player, char, weapon, rank, gain_in AS gain, mmr_before AS mmr, t, patch, in1000, route, tac, trait, gain AS net,
  kills, assists, deaths, damage, monsters FROM rows
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
// 루트는 많이 쓴 3개에 더해 2명 이상이 쓴 것을 20개까지 둠. 화면은 5개만 먼저 보여 줌
const ROUTE_TOP = 3;
const ROUTE_MAX = 20;
// 루트 표의 「300위 안」 전환. 경기 시각의 300위 RP 이상인 판만 따로 셈
const TOP_PLACE = 300;
const METRIC = ["kills", "assists", "deaths", "damage", "monsters"];
const METRIC_DIGITS = [2, 2, 2, 0, 1];

/** 다섯 지표가 모두 있는 행의 판당 평균. [킬, 어시스트, 사망, 피해량, 몬스터 처치] */
function metric(rows) {
  const sum = METRIC.map(() => 0);
  let n = 0;
  for (const r of rows) {
    if (METRIC.some((k) => r[k] == null)) continue;
    METRIC.forEach((k, i) => (sum[i] += r[k]));
    n++;
  }
  return n ? sum.map((v, i) => round(v / n, METRIC_DIGITS[i])) : undefined;
}

function routeList(rows) {
  return split(rows, "route")
    .sort((a, b) => b[1] - a[1] || b[2] - a[2])
    .filter((x, i) => i < ROUTE_TOP || x[1] >= 2)
    .slice(0, ROUTE_MAX);
}

function detail(rows, nm) {
  if (!rows.length) return {};
  const top = rows.filter((r) => r.top300);
  const keep = (list, name) =>
    list
      .filter((x) => x[2] / rows.length >= MIN_SHARE)
      .sort((a, b) => b[2] - a[2] || b[1] - a[1])
      .map(([code, ...rest]) => [name(code), ...rest, code]);
  return {
    dn: rows.length,
    routes: routeList(rows),
    ...(top.length && { tn: top.length, routesTop: routeList(top) }),
    traits: keep(split(rows, "trait"), nm.trait),
    tac: keep(split(rows, "tac"), nm.tac),
    metric: metric(rows),
  };
}

function view(id, label, rows, nm, extra = {}, k) {
  const r = scoreRows(rows, k ? { ...RULE, k } : RULE);
  if (!r) return null;
  const top = new Map();
  const own = [];
  for (const x of rows) {
    if (x.in1000 !== 1) continue;
    own.push(x);
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
    metric: metric(own),
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

/** 픽률을 참가자 비율로 쓰던 예전 파일은 경기당 등장률(참가자 비율 × 24)로 바꿔 읽음 */
function lobbyPick(t) {
  if (!t || t.pickBasis === "lobby") return t;
  const fix = (views) => views?.map((v) => ({ ...v, combos: v.combos.map((c) => ({ ...c, pick: round(c.pick * LOBBY, 2) })) }));
  return { ...t, pickBasis: "lobby", views: fix(t.views), ...(t.past && { past: { ...t.past, views: fix(t.past.views) } }) };
}

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
/** 게임 원본 루트 본문의 목표 아이템, 지역 순서, 패치 앞 두 자리. 문자열 JSON과 배열 모두 받음 */
function routeBody(w, nm, items) {
  const list = (v) => (typeof v === "string" ? JSON.parse(v || "[]") : (v ?? []));
  const codes = list(w.weaponCodes).filter((c) => c > 0);
  for (const c of codes) items[c] ??= nm.item(c);
  return [codes, list(w.paths).map((a) => nm.area(a)), w.version ? w.version.split(".").slice(0, 2).join(".") : null];
}

/** dak.gg 본문은 형식이 바뀌어도 publish가 멈추지 않게 읽지 못하면 null */
function dakBody(w, nm, items) {
  try {
    return [...routeBody(w, nm, items), 1];
  } catch {
    return null;
  }
}

async function routeMeta(s, ids, nm, used) {
  const top = topRanks.length ? topRanks : ((await get(`/v1/rank/top/${s.id}/3/10`))?.topRanks ?? []);
  // 루트는 시즌을 넘어 쓰이므로 작성자 키에 시즌을 넣지 않음
  const rank = new Map(top.map((x) => [playerId(0, x.nickname), x.rank]));
  const badge = new Map();
  const info = {};
  const items = {};
  for (const id of ids) {
    const raw = getRawRoute.get(id);
    const w = raw ? JSON.parse(brotliDecompressSync(raw.body)).route : null;
    const own = getRoute.get(id);
    // dak.gg에도 없던 루트는 모든 칸이 null인 행이라 없는 것으로 보고 특성과 전술 스킬을 판에서 고름
    const d = [getDak.get(id)].find((x) => x && [x.title, x.nick, x.trait, x.tac, x.body].some((v) => v != null));
    // 게임이 본문을 주지 않으면 dak.gg 본문을 쓰고 10번째 칸을 1로 둠. 둘 다 없으면 아이템과 지역이 null이라 화면이 불러올 수 없는 루트로 그림
    const dw = !w && d?.body ? JSON.parse(brotliDecompressSync(d.body)) : null;
    const body = w ? routeBody(w, nm, items) : (dw && dakBody(dw, nm, items)) || [null, null, null];
    // dak.gg 값은 게임에서 받은 칸이 비어 있을 때만 씀
    const r = d
      ? { author: own?.author ?? (d.nick ? playerId(0, d.nick) : null), title: own?.title ?? d.title, nick: own?.nick ?? d.nick, trait: own?.trait ?? d.trait, tac: own?.tac ?? d.tac }
      : own;
    // 원본은 있는데 routes 행이 없으면 recommend가 404였던 루트. 특성과 전술 스킬은 그 루트로 한 판에서 가장 많이 고른 값을 씀
    if (!r) {
      if (!raw) continue;
      const u = used.get(id);
      info[id] = [null, null, u?.trait ?? null, u?.trait ? nm.trait(u.trait) : null, u?.tac ?? null, u?.tac ? nm.tac(u.tac) : null, ...body];
      continue;
    }
    const at = r.author ? (rank.get(r.author) ?? null) : null;
    rankRoute.run(at, id);
    const b = at == null ? null : AUTHOR_BADGE.find(([max]) => at <= max)?.[1];
    if (b) badge.set(id, b);
    info[id] = [r.title, r.nick, r.trait, r.trait ? nm.trait(r.trait) : null, r.tac, r.tac ? nm.tac(r.tac) : null, ...body];
  }
  return { badge, info, items };
}

/** 루트마다 상위 1,000명이 가장 많이 고른 핵심 특성과 전술 스킬 */
function routeUse(rows, ids) {
  const count = new Map();
  for (const r of rows) {
    if (r.in1000 !== 1 || !ids.has(r.route)) continue;
    let c = count.get(r.route);
    if (!c) count.set(r.route, (c = { trait: new Map(), tac: new Map() }));
    for (const k of ["trait", "tac"]) if (r[k]) c[k].set(r[k], (c[k].get(r[k]) ?? 0) + 1);
  }
  const most = (m) => [...m].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return new Map([...count].map(([id, c]) => [id, { trait: most(c.trait), tac: most(c.tac) }]));
}

async function publish(s, nm) {
  const now = Date.now();
  const lastFile = join(DIR, "tier.json");
  const last = lobbyPick(existsSync(lastFile) ? JSON.parse(readFileSync(lastFile, "utf8")) : null);
  // 끝난 정규 시즌이 아직 현재 행이면 종료 뒤 첫 발행만 집계함. 다시 집계하면 최근 N일 탭이 줄고 오래된 행이 지워짐
  const ended = s.regular && now >= s.end && last?.season?.id === s.id && last.updatedAt >= s.end && !PUBLISH_ONLY;
  const all = s.regular && !ended ? selectRows.all(s.id, SERVER, s.start, s.id) : [];
  const cut300 = cutSeries(s.id, TOP_PLACE);
  for (const r of all) {
    const c = cutAt(cut300, r.t);
    r.top300 = c != null && r.mmr >= c;
  }
  // 프리 시즌과 새 시즌 첫 집계 전에는 마지막 표를 그대로 두고 상태만 바꿈
  if (!all.length) {
    if (last) writeTier({ ...last, state: "offseason", updatedAt: now, next: s.regular && last.season?.id !== s.id ? s.name : undefined });
    log(ended ? "시즌이 끝나 마지막 표를 유지합니다." : "집계할 행이 없어 마지막 표를 유지합니다.");
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
  const combos = [...views, ...(past?.views ?? [])].flatMap((v) => v.combos);
  const ids = [...new Set(combos.flatMap((c) => [...(c.routes ?? []), ...(c.routesTop ?? [])].map((x) => x[0])))];
  // --publish나 중단된 회차 뒤에도 화면에 오를 루트는 정보를 갖추게 함. 수집 회차에서는 이미 받아 요청이 없음
  if (!abort) await fetchRoutes(s, ids);
  // dak.gg에는 화면 루트 가운데 게임이 본문을 주지 않는 것만 루트마다 한 번 요청함
  if (!abort) await fetchDak(ids);
  const { badge, info, items } = await routeMeta(s, ids, nm, routeUse(all, new Set(ids)));
  for (const v of views) for (const c of v.combos) for (const x of [...(c.routes ?? []), ...(c.routesTop ?? [])]) if (badge.has(x[0])) x.push(badge.get(x[0]));
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
    pickBasis: "lobby",
    rate: existsSync(RATE) ? JSON.parse(readFileSync(RATE, "utf8")) : undefined,
    views,
    routes: info,
    items,
    ...(past && { past }),
  };
  writeTier(data);
  // RP 손익, 초반과 막판 집계는 저장된 원본에서만 만듦. 실패해도 티어 발행은 끝난 상태로 둠
  try {
    const out = derive(db.prepare(`SELECT t, body FROM raw.games WHERE season = ?`).iterate(s.id), data);
    if (writeDerived(join(OUT, ".."), out)) log(`RP 손익, 초반과 막판 집계 ${out.rp.games}경기`);
  } catch (e) {
    log(`RP 손익, 초반과 막판 집계 실패: ${e.message}`);
  }
  // 이번 회차에 랭킹을 받았을 때만 씀. --publish는 앞선 파일을 남김
  if (topRanks.length) {
    try {
      const first = topRanks.find((x) => x.rank === 1);
      const games = first?.nickname ? db.prepare(`SELECT t, rank, gain FROM rows WHERE player = ? AND season = ? ORDER BY t DESC LIMIT 10`).all(playerId(s.id, first.nickname), s.id) : [];
      writeTop(join(OUT, ".."), topView(first, games, RANKED_GATE, Date.now()));
    } catch (e) {
      log(`오버레이 1위 자료 쓰기 실패: ${e.message}`);
    }
  }
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
      log(`새 행 ${run.added}, 요청 ${stats.sent}, RP가 그대로라 건너뛴 계정 ${stats.skipped}, 429 응답 ${stats.limited}, 실패 ${stats.failed}, ${Math.round((Date.now() - startedAt) / 1000)}초`);
      writeFileSync(join(DIR, "status.json"), JSON.stringify({ at: Date.now(), abort, ...run, stats: { ...stats, lat: undefined } }));
    }
    // 프리 시즌이 끝난 뒤 두 회차 동안은 끝 시각까지 남은 번호를 마저 조회함
    const ps = !s.regular ? s : s.pre && Date.now() < s.pre.end + PRE_TAIL ? s.pre : null;
    if (ps && !pre) openPre();
    if (ps?.prev && Date.now() < ps.end + PRE_TAIL && !PUBLISH_ONLY && !abort) {
      const rps = pace.rps;
      const pr = await collectPre(ps);
      pace.set(rps);
      log(`경기 번호 ${pr.ids}개를 조회해 프리 시즌 경기 ${pr.games}개를 저장했습니다.${pr.refilled ? ` 예전 경기 ${pr.refilled}개를 다시 받았습니다.` : ""} 요청 ${stats.sent}, 429 응답 ${stats.limited}, 실패 ${stats.failed}, ${Math.round((Date.now() - startedAt) / 1000)}초`);
    }
    if (ps && !abort) publishPre(ps, nm);
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

// 프리 시즌 화면의 비교 기준으로 직전 정규 시즌 마지막 이틀의 경기를 한 번 모음. 정규 회차 20분 전에는 새 묶음을 시작하지 않음
if (flag("pre-base")) {
  const s = await season();
  if (!s || s.regular) throw new Error("프리 시즌이 아니라 실행하지 않습니다.");
  openPre();
  const base = { id: s.prev, prev: s.prev, start: s.start - 2 * 86_400_000, end: s.start };
  const unwatch = watchBot(Date.now(), 30_000);
  const slot = 3 * 3600_000;
  const offset = (2 * 60 + 25) * 60_000 - 9 * 3600_000;
  try {
    for (;;) {
      const next = Math.ceil((Date.now() - offset) / slot) * slot + offset;
      if (next - Date.now() < 20 * 60_000) {
        log("다음 정규 회차가 가까워 멈춥니다. 회차가 끝난 뒤 다시 실행하면 이어서 받습니다.");
        break;
      }
      const r = await scanPre({ ...base, deadline: next - 10 * 60_000 });
      log(`직전 시즌과 비교할 경기 번호 ${r.ids}개를 조회해 경기 ${r.games}개를 저장했습니다. 요청 ${stats.sent}, 429 응답 ${stats.limited}, 실패 ${stats.failed}`);
      if (abort || r.down || !r.ids) break;
    }
  } finally {
    unwatch();
  }
  if (!abort) publishPre(s, await names());
  process.exit(abort ? 3 : 0);
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
