// 보관기 DB(ARCHIVE_DIR/games.sqlite)의 랭크 경기로 아시아1 in1000 행을 쌓고 티어, RP 손익, 막판, 실험실 집계를 씀. 경기는 받지 않음
// 사용: node scripts/er/tier/collect.mjs [--publish] [--rps 10]. 정각 회차(hourly.mjs)가 보관기 다음에 띄움
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { brotliCompressSync, brotliDecompressSync, constants as zlib } from "node:zlib";
import { dakStopped } from "./dakstop.mjs";
import { derive, writeDerived } from "./derive.mjs";
import { Pace, botLast429 } from "./pace.mjs";
import { derivePre, writePre } from "./preseason.mjs";
import { RULE, scoreRows } from "./score.mjs";
import { topView, writeTop } from "./top.mjs";

const HOME = homedir();
const DIR = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
const OUT = process.env.TIER_OUT || join(HOME, "docker/_data/labs/er-tier");
const BOT = process.env.BOT_DIR || join(HOME, "docker/mongsil-bot");
const ARCHIVE = process.env.ARCHIVE_DIR || "/Volumes/SSD/ertier/archive";
// 정각 회차가 쓰는 순위 스냅숏, 이터컷 상태, 순위표. 닉네임이 들어 있어 labs 화면 경로 밖에 둠
const SNAPSHOTS = process.env.CUT_SNAPSHOTS || join(BOT, "data/labs/rank_snapshots.jsonl");
const CUT_STATE = process.env.CUT_STATE || join(BOT, "data/labs/rank_history.json");
const TOP_FILE = process.env.CUT_TOP || join(BOT, "data/labs/top.json");
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
// 작성자 닉네임은 게임 안 루트 목록에서 공개되는 값이라 이 표에만 평문으로 둠. 경기 원본과 rows는 playerId
const routeCols = new Set(db.prepare(`PRAGMA table_info(routes)`).all().map((c) => c.name));
for (const [c, t] of [["title", "TEXT"], ["nick", "TEXT"], ["trait", "INTEGER"], ["tac", "INTEGER"]]) if (!routeCols.has(c)) db.exec(`ALTER TABLE routes ADD COLUMN ${c} ${t}`);
// 루트 recommend 응답 원본. raw.games는 11-19까지 계정 수집기가 쓰던 표라 더 쓰지 않음
db.prepare(`ATTACH DATABASE ? AS raw`).run(join(DIR, "raw.sqlite"));
db.exec(`
  PRAGMA raw.journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS raw.routes (route INTEGER PRIMARY KEY, t INTEGER NOT NULL, body BLOB NOT NULL);
`);
// recommend가 404인 루트를 dak.gg에서 받은 값. 모든 칸이 null인 행은 dak.gg에도 없던 루트라 다시 묻지 않음
db.exec(`CREATE TABLE IF NOT EXISTS dak_routes (route INTEGER PRIMARY KEY, t INTEGER NOT NULL, title TEXT, nick TEXT, trait INTEGER, tac INTEGER)`);
// body는 11-12에 더한 dak.gg weaponRoute 원본(userNum 뺌). 이 열이 빈 옛 행은 아이템과 지역을 받으려고 한 번 다시 물음
if (!db.prepare(`PRAGMA table_info(dak_routes)`).all().some((c) => c.name === "body")) db.exec(`ALTER TABLE dak_routes ADD COLUMN body BLOB`);
// 닉네임 변경 기록은 그만두기로 함(510-1)
db.exec(`DROP TABLE IF EXISTS renames`);
// 보관기에서 읽은 랭크 경기. top은 상위 1,000명 참가 여부(컷을 모르면 NULL), sample은 순위표에 오른 닉네임 참가 여부, body는 RP 손익 집계용 필드만
db.exec(`
  CREATE TABLE IF NOT EXISTS src (game INTEGER PRIMARY KEY, season INTEGER NOT NULL, t INTEGER NOT NULL, top INTEGER, sample INTEGER NOT NULL, body BLOB);
  CREATE INDEX IF NOT EXISTS src_season ON src (season, sample);
  CREATE TABLE IF NOT EXISTS state (k TEXT PRIMARY KEY, v INTEGER);
`);
const getState = (k) => db.prepare(`SELECT v FROM state WHERE k = ?`).get(k)?.v ?? null;
const setState = db.prepare(`INSERT INTO state VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`);
const putSrc = db.prepare(`INSERT OR REPLACE INTO src VALUES (?, ?, ?, ?, ?, ?)`);
if (!existsSync(join(ARCHIVE, "games.sqlite"))) throw new Error(`${ARCHIVE}에 games.sqlite가 없습니다. SSD 마운트를 확인하세요.`);
db.prepare(`ATTACH DATABASE ? AS arc`).run(`file:${join(ARCHIVE, "games.sqlite")}?mode=ro`);const insertRow = db.prepare(`INSERT OR IGNORE INTO rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
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

const stats = { sent: 0, ok: 0, limited: 0, failed: 0, lat: [] };
// 경기는 보관기가 받아서 이 수집기는 메타, 순위표, 새 루트만 요청함
const pace = new Pace(opt("rps", 10));
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
  // 시작 시각에 바로 넘어가려고 기간으로 먼저 찾음. isCurrent는 API가 늦게 바꿀 수 있음
  const now = Date.now();
  const cur = list.find((x) => x.seasonStart && x.seasonEnd && kst(`${x.seasonStart}+0900`) <= now && now < kst(`${x.seasonEnd}+0900`)) ?? list.find((x) => x.isCurrent === 1);
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
  if (!existsSync(SNAPSHOTS)) return out;
  for (const line of readFileSync(SNAPSHOTS, "utf8").split("\n")) {
    if (!line) continue;
    const s = JSON.parse(line);
    if (s.s !== seasonId || !Array.isArray(s.rp)) continue;
    // 순위표 인원이 place보다 적으면 그 순위가 없어 8,300 이상이면 모두 상위권으로 셈
    out.push([s.t * 1000, s.rp.length < place ? RANKED_GATE : [...s.rp].sort((a, b) => b - a)[place - 1]]);
  }
  return out.sort((a, b) => a[0] - b[0]);
}

// 경기 시작 전 이만큼 안의 마지막 기록, 없으면 시작 뒤 이만큼 안의 첫 기록을 컷으로 씀
const CUT_NEAR = 6 * 3600_000;

/** 시각 t의 컷. 앞뒤 CUT_NEAR 안에 기록이 없으면 null */
function cutAt(series, t) {
  let lo = 0;
  let hi = series.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (series[mid][0] <= t) lo = mid + 1;
    else hi = mid;
  }
  const before = series[lo - 1];
  if (before && t - before[0] <= CUT_NEAR) return before[1];
  const after = series[lo];
  if (after && after[0] - t <= CUT_NEAR) return after[1];
  return null;
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
    state: (code) => stateKo.get(String(Math.floor(code / 100) * 100)) ?? `버프 ${code}`,
    weather: (code) => weatherKo.get(String(code)) ?? `날씨 ${code}`,
  };
}

/** 정각 회차가 받은 순위표. 오버레이 1위, 루트 작성자 배지, RP 손익 표본에 씀 */
let topRanks = [];

/** 경기 시작 때 RP가 그 시각 1,000위 컷과 8,300 가운데 큰 값 이상이면 1. 컷을 모르면 null */
function in1000Of(y, cut) {
  return cut == null || y.mmrBefore == null ? null : y.mmrBefore >= Math.max(cut, RANKED_GATE) ? 1 : 0;
}

/** 경기 기록 한 사람분을 행으로 넣고 넣은 행 수를 돌려줌 */
function insertGame(s, y, cut) {
  if (y.matchingMode !== 3 || y.seasonId !== s.id || !y.nickname) return 0;
  const who = playerId(s.id, y.nickname);
  const t = kst(y.startDtm);
  const patch = `${s.number}.${y.versionMajor}${y.versionMinor ? `.${y.versionMinor}` : ""}`;
  const in1000 = in1000Of(y, cut);
  const r = insertRow.run(
    y.gameId, who, s.id, t, patch, y.characterNum, y.bestWeapon, y.traitFirstCore ?? null, y.gameRank,
    y.mmrGainInGame ?? null, y.mmrLossEntryCost ?? null, y.mmrGain ?? null, y.mmrBefore ?? null,
    y.playerKill ?? null, y.damageToPlayer ?? null, y.serverName ?? null, cut, in1000,
    y.routeIdOfStart ?? null, y.tacticalSkillGroup ?? null, y.playerAssistant ?? null, y.playerDeaths ?? null, y.monsterKill ?? null,
  );
  return Number(r.changes);
}

function pack(value) {
  const json = Buffer.from(JSON.stringify(value));
  return brotliCompressSync(json, { params: { [zlib.BROTLI_PARAM_QUALITY]: 9, [zlib.BROTLI_PARAM_SIZE_HINT]: json.length } });
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

/** 보관기에서 시작 시각이 t 이상인 첫 경기 번호. 번호와 시작 시각이 대체로 함께 늘어서 이분 탐색으로 찾음 */
function gameIdAt(t) {
  const first = db.prepare(`SELECT game, t FROM arc.games WHERE game >= ? ORDER BY game LIMIT 1`);
  let lo = db.prepare(`SELECT min(game) AS g FROM arc.games`).get().g;
  let hi = db.prepare(`SELECT max(game) AS g FROM arc.games`).get().g;
  if (lo == null) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const g = first.get(mid);
    if (g.t < t) lo = g.game + 1;
    else hi = mid;
  }
  return lo;
}

// RP 손익과 막판 집계(derive.mjs)가 읽는 필드
const DERIVE_KEYS = [
  "matchingMode", "versionMajor", "versionMinor", "matchSize", "serverName", "gameRank", "characterNum", "bestWeapon",
  "duration", "mmrBefore", "mmrGain", "mmrLossEntryCost", "teamKill", "startDtm",
];
const ARC_MISS_MAX = 3;
// 번호가 시작 시각 순서와 조금 어긋나도 시즌 첫 경기를 놓치지 않게 앞으로 넉넉히 잡는 번호 수
const START_MARGIN = 20_000;
const INGEST_BATCH = 500;

/**
 * 보관기에 새로 들어온 이 시즌 랭크 경기를 한 번씩 읽음. 상위 1,000명이 참가한 경기는 참가자 전원,
 * 순위표에 오른 닉네임만 참가한 경기는 그 사람 행만 넣음. RP 손익 표본은 순위표에 오른 닉네임이 참가한 경기(510-2)
 */
function ingest(s) {
  const cuts = cutSeries(s.id);
  const tracked = new Set(topRanks.map((x) => x.nickname).filter(Boolean));
  try {
    const st = JSON.parse(readFileSync(CUT_STATE, "utf8"));
    if (st.players?.season === s.id) for (const name of Object.keys(st.players.list ?? {})) tracked.add(name);
  } catch {}
  const key = `ingest:${s.id}`;
  let lo = getState(key);
  if (lo == null) {
    const first = gameIdAt(s.start);
    if (first == null) return { games: 0, rows: 0, top: 0, unknown: 0 };
    lo = Math.max(0, first - START_MARGIN);
  }
  // 보관기가 다음 회차에 다시 받을 번호가 있으면 그 번호부터 다시 훑음
  const pending = getState(`pending:${s.id}`);
  const from = pending != null ? Math.min(lo, pending - 1) : lo;
  const list = db.prepare(`SELECT game, t, body FROM arc.games WHERE game > ? AND season = ? AND mode = 3 AND game NOT IN (SELECT game FROM src) ORDER BY game`);
  let games = 0, rows = 0, top = 0, unknown = 0, hi = lo;
  let batch = 0;
  db.exec("BEGIN");
  try {
    for (const g of list.iterate(from, s.id)) {
      hi = Math.max(hi, g.game);
      const ys = JSON.parse(brotliDecompressSync(g.body)).userGames ?? [];
      const cut = cutAt(cuts, g.t);
      const flags = ys.map((y) => in1000Of(y, cut));
      const isTop = cut == null ? null : flags.some((f) => f === 1) ? 1 : 0;
      const mine = ys.filter((y) => tracked.has(y.nickname));
      if (isTop === 1) for (const y of ys) rows += insertGame(s, y, cut);
      else for (const y of mine) rows += insertGame(s, y, cut);
      const sample = mine.length ? 1 : 0;
      const body = sample ? pack(ys.map((y) => Object.fromEntries(DERIVE_KEYS.map((k) => [k, y[k]])))) : null;
      putSrc.run(g.game, s.id, g.t, isTop, sample, body);
      games++;
      if (isTop === 1) top++;
      if (isTop == null) unknown++;
      if (++batch >= INGEST_BATCH) {
        db.exec("COMMIT");
        db.exec("BEGIN");
        batch = 0;
      }
    }
    setState.run(key, hi);
    setState.run(`pending:${s.id}`, db.prepare(`SELECT min(id) AS id FROM arc.miss WHERE n < ?`).get(ARC_MISS_MAX).id);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  if (unknown) log(`앞뒤 6시간 안에 컷 기록이 없어 상위권을 판정하지 못한 경기 ${unknown}개를 티어표에서 뺐습니다.`);
  return { games, rows, top, unknown };
}

// 프리 시즌 특집 집계가 읽는 보관기 rows 열. 닉네임 열은 읽지 않음
const PRE_COLS = "game, slot, season, t, mode, server, team, rank, char, weapon, bot, weather, exp, exp_reward, exp_credit, gadgets, drops, lumi, quest, equip, robot";

/** 프리 시즌 특집 집계. 보관기 행만 읽고 공식 API에는 요청하지 않음. 비교 기준은 직전 정규 시즌 마지막 이틀 */
function publishPre(s, nm) {
  try {
    const from = gameIdAt(s.start);
    if (from == null) return;
    const rowsOf = (season, a, b) => db.prepare(`SELECT ${PRE_COLS} FROM arc.rows WHERE game >= ? AND game < ? AND season = ? ORDER BY game, slot`).iterate(a, b, season);
    const baseFrom = s.prev ? gameIdAt(s.start - 2 * 86_400_000) : null;
    const base = baseFrom == null ? [] : rowsOf(s.prev, baseFrom, from);
    const out = derivePre(rowsOf(s.id, from, Number.MAX_SAFE_INTEGER), s, nm, null, base);
    if (out && writePre(join(OUT, ".."), out)) log(`프리 시즌 특집 집계 ${out.games}경기, 티어 ${out.tier?.combos.length ?? 0}개 조합`);
  } catch (e) {
    log(`프리 시즌 특집 집계 실패: ${e.message}`);
  }
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

// 상위 1,000명이 한 명이라도 참가한 경기는 ingest가 참가자 전원을 넣어서 픽률 분모인 팀 수가 맞음
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
    teams: r.teams,
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

/**
 * 픽률을 참가자 비율로 쓰던 예전 파일은 등장 수 / 팀 수로 바꿔 읽음. "lobby"는 잠깐 배포한 참가자 비율 × 24.
 * 예전 파일에는 팀 수가 없지만 집계 경기 팀은 거의 다 3명이라 참가자 비율의 3배로 봄
 */
function teamPick(t) {
  if (!t || t.pickBasis === "team") return t;
  const k = t.pickBasis === "lobby" ? 24 : 1;
  const fix = (views) => views?.map((v) => ({ ...v, combos: v.combos.map((c) => ({ ...c, pick: round((c.pick / k) * 3, 2) })) }));
  return { ...t, pickBasis: "team", views: fix(t.views), ...(t.past && { past: { ...t.past, views: fix(t.past.views) } }) };
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
  const last = teamPick(existsSync(lastFile) ? JSON.parse(readFileSync(lastFile, "utf8")) : null);
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
    pickBasis: "team",
    views,
    routes: info,
    items,
    ...(past && { past }),
  };
  writeTier(data);
  // RP 손익, 초반과 막판 집계는 저장된 원본에서만 만듦. 실패해도 티어 발행은 끝난 상태로 둠
  try {
    const out = derive(db.prepare(`SELECT t, body FROM src WHERE season = ? AND sample = 1`).iterate(s.id), data);
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

/** 정각 회차가 쓴 순위표. 없거나 두 시간보다 오래됐으면 한 번 받음 */
async function loadTop(s) {
  try {
    const t = JSON.parse(readFileSync(TOP_FILE, "utf8"));
    if (t.season === s.id && Date.now() - t.at < 2 * 3600_000 && Array.isArray(t.topRanks)) return t.topRanks;
  } catch {}
  return (await get(`/v1/rank/top/${s.id}/3/10`))?.topRanks ?? [];
}

// 프리 시즌이 끝난 뒤에도 보관기가 마지막 경기를 받을 때까지 특집 집계를 이어 씀
const PRE_TAIL = 6 * 3600_000;

async function once() {
  abort = null;
  const startedAt = Date.now();
  const unwatch = watchBot(startedAt, 30_000);
  try {
    const s = await season();
    if (!s) throw new Error("현재 시즌을 찾지 못했습니다.");
    const nm = await names();
    if (s.regular && Date.now() < s.end && !PUBLISH_ONLY) {
      topRanks = await loadTop(s);
      const r = ingest(s);
      log(`보관기에서 랭크 경기 ${r.games}개를 읽어 행 ${r.rows}개를 저장했습니다. 상위 1,000명이 참가한 경기는 ${r.top}개입니다. ${Math.round((Date.now() - startedAt) / 1000)}초가 걸렸습니다.`);
      if (!abort) await fetchRoutes(s);
      writeFileSync(join(DIR, "status.json"), JSON.stringify({ at: Date.now(), abort, ingest: r, stats: { ...stats, lat: undefined } }));
    }
    const ps = !s.regular ? s : s.pre && Date.now() < s.pre.end + PRE_TAIL ? s.pre : null;
    if (ps && !abort) publishPre(ps, nm);
    if (!abort) await publish(s, nm);
  } finally {
    unwatch();
  }
  return !abort;
}

if (!(await once())) process.exitCode = 3;
