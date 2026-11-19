// 이터런 목록을 1분마다 갱신(장부 552). 대회 규칙이 Global 통합 순위라 서버 코드 없는 통합 순위표 1건만 부름
// 사용: node scripts/er/tier/race-live.mjs. LaunchAgent dev.mongsil.ertier-race가 60초마다 띄우고, 앞 실행이 안 끝났으면 launchd가 건너뜀
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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

const res = await fetch(`${API}/v1/rank/top/${seasonId}/3`, { headers: { "x-api-key": KEY, "user-agent": "agent-local" }, signal: AbortSignal.timeout(20_000) });
const body = res.status === 200 ? await res.json() : null;
if (res.status === 429 || res.status === 403 || body?.code === 429) {
  writeFileSync(STOP, String(Date.now()));
  log(`한도 응답 ${res.status}을 받았습니다. 10분 기다립니다.`);
  process.exit(0);
}
if (!Array.isArray(body?.topRanks)) {
  log(`순위표를 받지 못했습니다. HTTP ${res.status}`);
  process.exit(1);
}
const top = body.topRanks;
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
