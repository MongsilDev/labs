import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import zlib from "node:zlib";
import { RANKED_GATE, byRp } from "./etercut.mjs";

// 시즌 초 이터컷 자리에 보여 줄 이터니티 선착순(장부 528). 아시아1 계정이 RANKED_GATE에 처음 닿은 경기 종료 시각을 보관기 원본에서 찾음
// 기록 파일에는 보관기 닉네임이 들어 있어 몽실봇 자료 폴더에 두고, 공개 race.json에는 그 시각 순위표에 오른 닉네임만 씀(528-3)

const SERVER = "Asia";
const RANKED = 3;
const MISS_MAX = 3;

const kstMs = (s) => Date.parse(String(s).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));

export function loadRace(path, seasonId) {
  try {
    const s = JSON.parse(readFileSync(path, "utf8"));
    if (s?.season === seasonId && Number.isFinite(s.cursor)) return { pending: [], reached: {}, ...s };
  } catch {}
  return { season: seasonId, cursor: null, base: null, pending: [], reached: {} };
}

/** 경기 원본 하나에서 RANKED_GATE를 넘은 아시아1 랭크 참가자를 reached에 남김. 더 이른 시각만 덮어씀 */
export function scanGame(state, body) {
  const users = body?.userGames ?? [];
  for (const u of users) {
    if (u.serverName !== SERVER || u.matchingMode !== RANKED || !u.nickname) continue;
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

/**
 * 공개용 race.json. open은 순위표 300위가 RANKED_GATE를 넘기 전(528-2), list는 지금 순위표에서 RANKED_GATE 이상인 계정을 도달 순서로
 * 도달 경기를 보관기에서 찾지 못한 계정은 at null로 맨 뒤
 */
export function raceBoard(state, { seasonId, top, now }) {
  const ranked = byRp((top ?? []).filter((r) => r.mmr));
  const r300 = ranked[299];
  const open = !(r300 && Math.trunc(r300.mmr) > RANKED_GATE);
  const list = ranked
    .filter((r) => Math.trunc(r.mmr) >= RANKED_GATE)
    .map((r) => ({ nickname: r.nickname, rp: Math.trunc(r.mmr), at: state.reached[r.nickname] != null ? Math.round(state.reached[r.nickname] / 1000) : null }))
    .sort((a, b) => (a.at ?? Infinity) - (b.at ?? Infinity) || b.rp - a.rp);
  return { updatedAt: Math.round(now), season: seasonId, open, count: list.length, list: open ? list : [] };
}
