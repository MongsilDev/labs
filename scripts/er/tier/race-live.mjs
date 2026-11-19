// 이터런 목록을 1분마다 갱신(장부 552). 대회 규칙이 Global 통합 순위라 서버 코드 없는 통합 순위표를 씀
// 같은 순위표로 아시아1 순위도 다시 만들어 asia1.json에 씀(asia1.mjs). 공식 아시아1 순위표 1건과 처음 보는 계정의 서버 확인만 더 부름
// 사용: node scripts/er/tier/race-live.mjs. LaunchAgent dev.mongsil.ertier-race가 60초마다 띄우고, 앞 실행이 안 끝났으면 launchd가 건너뜀
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { RECHECK_MS, RETRY_MS, buildAsia, isActive, lookupQueue, pruneIds } from "./asia1.mjs";
import { loadRace, raceBoard, recordHist, scanArchive, trackLive } from "./race.mjs";

const HOME = homedir();
const BOT = process.env.BOT_DIR || join(HOME, "docker/mongsil-bot");
const API = process.env.TIER_API || "https://open-api.bser.io";
const ARCHIVE = process.env.ARCHIVE_DIR || "/Volumes/SSD/ertier/archive";
const LABS = join(BOT, "data/labs");
const CUT_DIR = process.env.CUT_DIR || join(HOME, "docker/_data/labs/er-cut");
const RACE_STATE = process.env.RACE_STATE || join(LABS, "race_state.json");
// 한도 응답을 받으면 이 파일을 남기고 10분 동안 부르지 않음. 다른 수집기는 같은 키를 초당 45회까지 씀
const STOP = join(LABS, "race-live.stopped");
const PAUSE = 10 * 60_000;
// 닉네임이 들어 있어 몽실봇 자료 폴더에 둠. 몽실봇은 data/labs/asia1.json을 읽음
const ASIA_FILE = process.env.ASIA_FILE || join(LABS, "asia1.json");
const ASIA_IDS = process.env.ASIA_IDS || join(LABS, "asia1_ids.json");
// 계정당 2건이라 회차마다 최대 50건을 초당 2.5건으로. 보관기가 초당 45건까지 써서 남는 몫 안에 둠
const LOOKUP_MAX = 25;
const LOOKUP_GAP = 400;
// 회차 제한 50초 안에 끝나도록 서버 확인은 시작 뒤 30초까지만 새로 시작하고, 요청 하나는 8초에서 끊음
const LOOKUP_UNTIL = 30_000;
const LOOKUP_TIMEOUT = 8_000;
const started = Date.now();

const log = (...a) => console.log(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }), ...a);

function writeAtomic(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = join(dirname(file), `.${file.split("/").at(-1)}.${process.pid}`);
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

if (existsSync(STOP) && Date.now() - statSync(STOP).mtimeMs < PAUSE) process.exit(0);
// 시즌은 정각 회차가 쓴 cut.json을 따름. 시즌 목록을 1분마다 다시 받지 않음
const seasonId = JSON.parse(readFileSync(join(CUT_DIR, "cut.json"), "utf8"))?.season?.id;
if (!seasonId) throw new Error("cut.json에 시즌이 없습니다.");
const KEY = readFileSync(join(BOT, ".env"), "utf8").match(/^API_KEY=["']?([^"'\r\n]+)/m)?.[1];
if (!KEY) throw new Error("API_KEY를 찾지 못했습니다.");

class Limited extends Error {}
/** 본문. 한도 응답이면 STOP을 남기고 Limited를 던짐 */
async function get(path, ms = 20_000) {
  const res = await fetch(API + path, { headers: { "x-api-key": KEY, "user-agent": "agent-local" }, signal: AbortSignal.timeout(ms) });
  const body = res.status === 200 ? await res.json() : null;
  if (res.status === 429 || res.status === 403 || body?.code === 429) {
    writeFileSync(STOP, String(Date.now()));
    log(`한도 응답 ${res.status}을 받았습니다. 10분 기다립니다.`);
    throw new Limited();
  }
  return { status: res.status, body };
}

let res, body;
try {
  ({ status: res, body } = await get(`/v1/rank/top/${seasonId}/3`));
} catch (e) {
  if (e instanceof Limited) process.exit(0);
  throw e;
}
if (!Array.isArray(body?.topRanks)) {
  log(`순위표를 받지 못했습니다. HTTP ${res}`);
  process.exit(1);
}
const top = body.topRanks;
// 아시아1 재구성은 직전 회차까지 확인한 서버로 먼저 쓰고, 새 계정의 서버 확인은 남은 시간에 함
let ids = {};
try {
  const saved = JSON.parse(readFileSync(ASIA_IDS, "utf8"));
  if (saved.season === seasonId) ids = saved.ids;
} catch {}
try {
  let official = null;
  let prev = null;
  try {
    prev = JSON.parse(readFileSync(ASIA_FILE, "utf8"));
  } catch {}
  const r = await get(`/v1/rank/top/${seasonId}/3/10`, LOOKUP_TIMEOUT).catch((e) => {
    if (e instanceof Limited) process.exit(0);
    return null;
  });
  official = Array.isArray(r?.body?.topRanks) ? r.body.topRanks.length : r?.body?.code === 404 ? 0 : null;
  const asia = buildAsia(top, ids);
  // 공식 순위표 요청이 실패한 회차는 직전 판정을 이어 감. 한 번 실패로 정상인 공식 순위표를 덮지 않게 함
  const active = official == null && prev?.season === seasonId ? Boolean(prev.active) && isActive(null, asia.topRanks.length, asia.unknown) : isActive(official, asia.topRanks.length, asia.unknown);
  writeAtomic(ASIA_FILE, JSON.stringify({ at: Date.now(), season: seasonId, active, official, count: asia.topRanks.length, unknown: asia.unknown, topRanks: asia.topRanks }));
} catch (e) {
  log(`아시아1 순위를 다시 만들지 못했습니다. ${e.message}`);
  process.exitCode = 1;
}

const now = Date.now() / 1000;
const state = loadRace(RACE_STATE, seasonId);
// 300위가 8,300을 넘은 뒤에는 보관기를 더 읽지 않음
const open = raceBoard(state, { seasonId, top, now }).open;
if (open) {
  scanArchive(state, join(ARCHIVE, "games.sqlite"));
  trackLive(state, top, now);
  recordHist(state, top, now);
  writeAtomic(RACE_STATE, JSON.stringify(state));
}
const out = raceBoard(state, { seasonId, top, now });
writeAtomic(join(CUT_DIR, "race.json"), JSON.stringify(out));

/** 계정의 이 시즌 순위 서버. 시즌이 끝나면 serverCode가 접속 서버로 바뀌어 보상 서버 코드를 먼저 씀. 못 찾으면 null */
async function serverOf(name, e) {
  let uid = e?.u;
  if (!uid) {
    const r = await get(`/v1/user/nickname?query=${encodeURIComponent(name)}`, LOOKUP_TIMEOUT);
    uid = r.body?.user?.userId ?? r.body?.user?.uid;
    if (!uid) return { s: null, u: null };
    await new Promise((r) => setTimeout(r, LOOKUP_GAP));
  }
  const r = await get(`/v1/rank/uid/${uid}/${seasonId}/3`, LOOKUP_TIMEOUT);
  const u = r.body?.code === 200 ? r.body.userRank : null;
  // 저장한 uid가 무효가 되면 다음 회차에 닉네임으로 다시 찾음
  if (!u) return { s: null, u: null };
  // 시즌 43 전수 조회에서 서버 코드가 0인 계정 3명은 아시아1 순위표에 없어 다른 서버로 셈
  return { s: u.rewardServerCode || u.serverCode || 0, u: uid };
}

const t = Date.now();
try {
  for (const name of lookupQueue(top, ids, t, LOOKUP_MAX)) {
    if (Date.now() - started > LOOKUP_UNTIL) break;
    const old = ids[name];
    const found = await serverOf(name, old);
    // 하루마다 다시 확인하다 못 찾으면 알던 서버는 두고 한 시간 뒤 다시 찾음
    ids[name] = found.s == null && old?.s != null ? { ...old, u: null, t: Date.now() - RECHECK_MS + RETRY_MS } : { ...old, ...found, t: Date.now() };
    await new Promise((r) => setTimeout(r, LOOKUP_GAP));
  }
} catch (e) {
  if (!(e instanceof Limited)) log(`서버를 확인하지 못했습니다. ${e.message}`);
}
pruneIds(ids, top, t);
writeAtomic(ASIA_IDS, JSON.stringify({ season: seasonId, ids }));
