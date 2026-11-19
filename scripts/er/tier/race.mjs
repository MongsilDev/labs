import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import zlib from "node:zlib";
import { RANKED_GATE, byRp } from "./etercut.mjs";

// 시즌 초 이터컷 자리에 보여 줄 이터런(장부 528, 552). 계정이 RANKED_GATE에 처음 닿은 시각을 1분마다 받는 통합 순위표와 보관기 원본에서 찾음
// 대회 규칙이 Global 통합 순위라 서버를 가리지 않음. 시즌 43 아시아1 순위표는 상위권이 빠져 있어 쓰지 않음
// 기록 파일에는 보관기 닉네임이 들어 있어 몽실봇 자료 폴더에 두고, 공개 race.json에는 그 시각 순위표에 오른 닉네임만 씀(528-3)

const RANKED = 3;
const MISS_MAX = 3;
const LIST = 10;
const LIVE_KEEP = 300;
const HIST_KEEP = 28 * 3600;
const DAY = 24 * 3600;

const kstMs = (s) => Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));

export function loadRace(path, seasonId) {
  try {
    const s = JSON.parse(readFileSync(path, "utf8"));
    if (s?.season === seasonId && Number.isFinite(s.cursor)) return { pending: [], reached: {}, hist: [], ...s };
    // 보관기가 없어 커서를 못 정한 회차에도 24시간 기록과 순위표로 잡은 도달 시각, 최근 판 변화는 이어 감
    if (s?.season === seasonId && Array.isArray(s.hist)) return { pending: [], reached: {}, ...s, cursor: null, base: null };
  } catch {}
  return { season: seasonId, cursor: null, base: null, pending: [], reached: {}, hist: [] };
}

/**
 * 1분마다 받은 순위표로 계정마다 마지막 RP, 직전 값 대비 변화, 바뀐 시각을 남김. 판마다 RP가 바뀌므로 변화는 마지막 한 판 몫
 * 직전 회차에 RANKED_GATE 아래였다가 넘은 계정은 이번 시각을 도달 시각으로 남기고, 보관기가 더 이른 경기 종료 시각을 찾으면 scanGame이 덮어씀
 */
export function trackLive(state, top, now) {
  const last = state.last ?? {};
  const next = {};
  // 목록과 도달 판정에 쓰는 상위권만 남겨 1분마다 쓰는 기록 파일을 작게 둠
  for (const r of byRp((top ?? []).filter((x) => x.nickname && x.mmr)).slice(0, LIVE_KEEP)) {
    const rp = Math.trunc(r.mmr);
    const old = last[r.nickname];
    next[r.nickname] = !old || old[0] === rp ? (old ?? [rp, null, null]) : [rp, rp - old[0], Math.round(now)];
    if (old && old[0] < RANKED_GATE && rp >= RANKED_GATE && state.reached[r.nickname] == null) state.reached[r.nickname] = Math.round(now * 1000);
  }
  state.last = next;
}

/** 경기 원본 하나에서 RANKED_GATE를 넘은 랭크 참가자를 reached에 남김. 더 이른 시각만 덮어씀 */
export function scanGame(state, body) {
  const users = body?.userGames ?? [];
  for (const u of users) {
    if (u.matchingMode !== RANKED || !u.nickname) continue;
    if (!(u.mmrBefore < RANKED_GATE && u.mmrAfter >= RANKED_GATE)) continue;
    const at = kstMs(u.startDtm) + (u.duration ?? 0) * 1000;
    if (!Number.isFinite(at)) continue;
    const old = state.reached[u.nickname];
    if (old == null || at < old) state.reached[u.nickname] = at;
  }
}

/**
 * 보관기 커서까지 새로 들어온 시즌 경기를 훑음. 보관기가 받지 못한 번호(miss)는 나중에 채워지므로 pending에 두고 다음 회차에 다시 봄
 * 반환: 이번에 읽은 경기 수. 보관기가 없으면 null
 */
export function scanArchive(state, dbPath) {
  if (!existsSync(dbPath)) return null;
  const db = new DatabaseSync(dbPath, { readOnly: true });
  // 상주 보관기가 함께 돌 때 miss에서 지워진 번호를 놓치지 않게 모든 조회를 한 시점에서 봄. 보관기 DB는 WAL이라 쓰기를 막지 않음
  try {
    db.exec("BEGIN");
    const top = db.prepare(`SELECT v FROM state WHERE k = 'cursor'`).get()?.v;
    if (top == null) return 0;
    // 시즌 첫 회차에만 games를 한 번 훑어 시작 번호를 정함. 그 아래 번호는 다른 시즌이라 다시 보지 않음
    if (state.cursor == null) state.base = state.cursor = (db.prepare(`SELECT min(game) AS g FROM games WHERE season = ?`).get(state.season)?.g ?? top + 1) - 1;
    let n = 0;
    const read = (row) => {
      if (!row) return;
      try {
        scanGame(state, JSON.parse(zlib.brotliDecompressSync(row.body).toString()));
        n++;
      } catch (e) {
        // 깨진 원본 하나 때문에 커서가 멈추지 않게 건너뜀
        console.error(`선착순: 경기 원본을 읽지 못했습니다. ${e.message}`);
      }
    };
    const one = db.prepare(`SELECT body FROM games WHERE game = ? AND season = ? AND mode = ?`);
    for (const id of state.pending) read(one.get(id, state.season, RANKED));
    for (const row of db.prepare(`SELECT body FROM games WHERE game > ? AND game <= ? AND season = ? AND mode = ?`).iterate(state.cursor, top, state.season, RANKED)) read(row);
    // 보관기는 다시 받은 번호를 miss에서 지우므로 남은 번호만 다음 회차에 다시 봄
    state.pending = db.prepare(`SELECT id FROM miss WHERE n < ? AND id > ?`).all(MISS_MAX, state.base ?? state.cursor).map((r) => r.id);
    state.cursor = Math.max(state.cursor, top);
    return n;
  } finally {
    try {
      if (db.isTransaction) db.exec("COMMIT");
    } finally {
      db.close();
    }
  }
}

/** 24시간 변화용으로 순위표 상위 100명 RP를 한 시간에 한 번 남김 */
export function recordHist(state, top, now) {
  const hist = (state.hist ?? []).filter((h) => now - h[0] < HIST_KEEP);
  if (!hist.length || Math.floor(hist.at(-1)[0] / 3600) !== Math.floor(now / 3600))
    hist.push([now, Object.fromEntries(byRp((top ?? []).filter((r) => r.mmr && r.nickname)).slice(0, 100).map((r) => [r.nickname, Math.trunc(r.mmr)]))]);
  state.hist = hist;
}

/** 24시간 전에 가장 가까운 20~28시간 전 기록 */
function dayAgo(state, now) {
  const old = (state.hist ?? []).filter((h) => 20 * 3600 <= now - h[0] && now - h[0] <= HIST_KEEP);
  return old.length ? old.reduce((a, b) => (Math.abs(now - b[0] - DAY) < Math.abs(now - a[0] - DAY) ? b : a))[1] : {};
}

/**
 * 공개용 race.json. open은 순위표 300위가 RANKED_GATE를 넘기 전(528-2)
 * list는 도달한 계정을 도달 순서로, 그 뒤에 아직 못 닿은 계정을 RP순으로 LIST명까지. 도달은 보관기에서 넘은 경기를 찾았거나 지금 RANKED_GATE 이상
 * count는 지금 순위표에 있는 도달 계정 수. gain은 24시간 RP 변화이고 기록이 없으면 null. diff와 diffAt은 마지막으로 바뀐 판의 RP 변화와 그 시각
 */
export function raceBoard(state, { seasonId, top, now }) {
  const ranked = byRp((top ?? []).filter((r) => r.mmr));
  const r300 = ranked[299];
  const open = !(r300 && Math.trunc(r300.mmr) > RANKED_GATE);
  const before = dayAgo(state, now);
  const rows = ranked.map((r) => {
    const rp = Math.trunc(r.mmr);
    const at = state.reached[r.nickname] != null ? Math.round(state.reached[r.nickname] / 1000) : null;
    const live = state.last?.[r.nickname];
    return { nickname: r.nickname, rp, at, gain: before[r.nickname] != null ? rp - before[r.nickname] : null, diff: live?.[1] ?? null, diffAt: live?.[2] ?? null, done: at != null || rp >= RANKED_GATE };
  });
  const done = rows.filter((r) => r.done).sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || b.rp - a.rp);
  const list = [...done, ...rows.filter((r) => !r.done)].slice(0, LIST).map(({ nickname, rp, at, gain, diff, diffAt }) => ({ nickname, rp, at, gain, diff, diffAt }));
  return { updatedAt: Math.round(now), season: seasonId, open, count: done.length, list: open ? list : [] };
}
