// 아시아1 in1000 경기 기록 수집과 티어 집계. 호스트에서 실행, 원시 행은 TIER_DIR SQLite, 집계는 TIER_OUT/tier.json
// 사용: node scripts/er/tier/collect.mjs [--measure] [--rps 10] [--days 7] [--every 180] [--once]
import { execFileSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { RULE, scoreRows } from "./score.mjs";

const HOME = homedir();
const DIR = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
const OUT = process.env.TIER_OUT || join(HOME, "docker/_data/labs/er-tier");
const BOT = process.env.BOT_DIR || join(HOME, "docker/mongsil-bot");
const API = "https://open-api.bser.io";
const SERVER = "Asia";
const RANKED_GATE = 8300;
const SEASON_NAME_OFFSET = 9;
const PUBLISH_ROWS = Number(process.env.TIER_PUBLISH_ROWS || 15000);
const MAX_PAGES = 80;
const STEPS = [5, 10, 20, 30, 50];
const STEP_MS = 60_000;
const WINDOWS = [7, 3, 1];
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
    server TEXT, cut INTEGER, in1000 INTEGER,
    PRIMARY KEY (game, player)
  );
  CREATE INDEX IF NOT EXISTS rows_t ON rows (season, t);
  CREATE TABLE IF NOT EXISTS accounts (player TEXT PRIMARY KEY, newest INTEGER, checked INTEGER);
`);
const insertRow = db.prepare(`INSERT OR IGNORE INTO rows VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const getAccount = db.prepare(`SELECT newest FROM accounts WHERE player = ?`);
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
  const chars = new Map(((await get("/v2/data/Character"))?.data ?? []).map((c) => [c.code, c.name]));
  return {
    char: (code) => ({ key: chars.get(code) ?? String(code), name: charKo.get(String(code)) ?? chars.get(code) ?? String(code) }),
    weapon: (code) => typeKo.get(WEAPON[code]) ?? `무기 ${code}`,
  };
}

/** 지금 1000명과 since 뒤 1000위 안에 든 적 있는 계정. 닉네임은 uid를 찾는 데만 쓰고 저장하지 않음 */
async function accounts(s, since) {
  const top = (await get(`/v1/rank/top/${s.id}/3/10`))?.topRanks ?? [];
  let book = {};
  try {
    const b = JSON.parse(readFileSync(join(BOT, "data/rank_history.json"), "utf8"));
    if (b.players?.season === s.id) book = b.players.list ?? {};
  } catch {}
  const names = new Set(top.map((x) => x.nickname));
  for (const [name, v] of Object.entries(book)) if (v[3] && v[3] * 1000 >= since) names.add(name);
  return [...names].map((name) => ({ name, uid: book[name]?.[6] ?? null }));
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
      if (y.matchingMode !== 3 || y.seasonId !== s.id) continue;
      const patch = `${s.number}.${y.versionMajor}${y.versionMinor ? `.${y.versionMinor}` : ""}`;
      const cut = cutAt(cuts, t);
      const in1000 = cut == null || y.mmrBefore == null ? null : y.mmrBefore >= Math.max(cut, RANKED_GATE) ? 1 : 0;
      const r = insertRow.run(
        y.gameId, y.nickname ? playerId(s.id, y.nickname) : player, s.id, t, patch, y.characterNum, y.bestWeapon, y.traitFirstCore ?? null, y.gameRank,
        y.mmrGainInGame ?? null, y.mmrLossEntryCost ?? null, y.mmrGain ?? null, y.mmrBefore ?? null,
        y.playerKill ?? null, y.damageToPlayer ?? null, y.serverName ?? null, cut, in1000,
      );
      added += Number(r.changes);
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
  return { added, accounts: list.length, ...result };
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

const selectRows = db.prepare(`SELECT game, player, char, weapon, rank, gain_in AS gain, t, patch FROM rows
  WHERE season = ? AND in1000 = 1 AND server = ? AND gain_in IS NOT NULL AND t >= ? ORDER BY t`);

function view(id, label, rows, nm, extra = {}, k) {
  const r = scoreRows(rows, k ? { ...RULE, k } : RULE);
  if (!r) return null;
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
      place: round(c.place, 2),
      top3: round(c.top3 * 100, 1),
      win: round(c.win * 100, 1),
      pick: round(c.pick * 100, 2),
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

function publish(s, nm) {
  const now = Date.now();
  const all = s.regular ? selectRows.all(s.id, SERVER, s.start) : [];
  // 프리 시즌과 새 시즌 첫 경기 전에는 마지막 표를 그대로 두고 상태만 바꿈
  if (!all.length) {
    const last = join(DIR, "tier.json");
    if (existsSync(last)) writeTier({ ...JSON.parse(readFileSync(last, "utf8")), state: "offseason", updatedAt: now });
    log("집계할 행이 없어 마지막 표를 유지합니다.");
    return;
  }
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
  const curRows = all.filter((r) => r.patch === cur);
  // 짧은 기간은 조합 사이 분산을 추정하기에 표본이 적어 패치 전체의 지표별 k를 씀
  const k = views.find((v) => v.patch === cur)?.ks;
  for (const d of WINDOWS) {
    const rows = curRows.filter((r) => r.t >= now - d * 86_400_000);
    const v = view(`${d}d`, `최근 ${d}일`, rows, nm, { patch: cur, days: d }, k);
    if (v) views.push(v);
  }
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
    if (s.regular && Date.now() < s.end) {
      const since = Math.max(s.start, Date.now() - opt("days", 11) * 86_400_000);
      run = await collect(s, since, { measure });
      log(`새 행 ${run.added}, 요청 ${stats.sent}, 한도 응답 ${stats.limited}, 실패 ${stats.failed}, ${Math.round((Date.now() - startedAt) / 1000)}초`);
      writeFileSync(join(DIR, "status.json"), JSON.stringify({ at: Date.now(), abort, ...run, stats: { ...stats, lat: undefined } }));
    }
    if (!abort) publish(s, nm);
  } finally {
    unwatch();
  }
  return !abort;
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
