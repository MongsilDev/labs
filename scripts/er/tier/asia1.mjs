// 공식 아시아1 순위표가 비정상인 동안 통합 순위표에서 serverCode 10 계정만 RP순으로 세어 아시아1 순위를 만듦
// 시즌 43 첫날 /v1/rank/top/43/3/10이 20명 남짓만 주고 계정별 serverRank도 0이었음. 정리 문서는 ~/plans/labs/asia1_rank_1119.md
// race-live.mjs가 1분마다 asia1.json을 쓰고, 정각 회차와 몽실봇은 active인 동안 이 순위를 공식 순위표 대신 씀

export const ASIA1 = 10;
// 공식 순위표가 이만큼 차거나 재구성 인원 이상이면 정상으로 보고 공식 순위표로 돌아감
export const FULL = 990;
// 서버를 모르는 계정이 이보다 많으면 다른 서버 계정이 섞였을 수 있어 쓰지 않음
export const UNKNOWN_MAX = 50;
// race-live가 한도 응답으로 10분 쉬는 동안에도 쓰도록 15분까지 유효
export const FRESH_MS = 15 * 60_000;
// 서버는 거의 바뀌지 않아 하루에 한 번만 다시 확인하고, 닉네임으로 못 찾은 계정은 한 시간 뒤 다시 찾음
export const RECHECK_MS = 24 * 3600_000;
export const RETRY_MS = 3600_000;

/** 공식 순위표를 쓸 수 없는 상태인지. official은 공식 아시아1 인원, 받지 못했으면 null */
export function isActive(official, count, unknown = 0) {
  return count >= 300 && unknown <= UNKNOWN_MAX && (official == null || official < Math.min(FULL, count));
}

/** 정각 회차가 직접 받은 공식 순위표가 정상이 아닐 때만 재구성 순위로 바꿈 */
export function officialShort(top, asia) {
  return (top?.length ?? 0) < Math.min(FULL, asia.count ?? asia.topRanks.length);
}

/**
 * 통합 순위표에서 아시아1 계정만 RP순으로 다시 매긴 순위표. 서버를 아직 모르는 계정은 통합 1,001명 대부분이 아시아1이라 아시아1로 셈
 * ids는 닉네임별 { s: serverCode, u: userId, t: 확인 시각 }
 */
export function buildAsia(top, ids) {
  const rows = (top ?? []).filter((r) => r.nickname && r.mmr);
  let unknown = 0;
  const kept = rows.filter((r) => {
    const s = ids[r.nickname]?.s;
    if (s == null) unknown++;
    return s == null || s === ASIA1;
  });
  kept.sort((a, b) => Math.trunc(b.mmr) - Math.trunc(a.mmr) || (a.rank ?? 0) - (b.rank ?? 0));
  return { unknown, topRanks: kept.map((r, i) => ({ nickname: r.nickname, rank: i + 1, mmr: r.mmr })) };
}

/** 이번 회차에 서버를 확인할 닉네임. 처음 보는 계정, 못 찾은 지 한 시간 지난 계정, 확인한 지 하루 지난 계정 순으로 limit명 */
export function lookupQueue(top, ids, now, limit) {
  const fresh = [], retry = [], stale = [];
  for (const r of top ?? []) {
    if (!r.nickname) continue;
    const e = ids[r.nickname];
    if (!e) fresh.push(r.nickname);
    else if (e.s == null && now - e.t > RETRY_MS) retry.push(r.nickname);
    else if (e.s != null && now - e.t > RECHECK_MS) stale.push(r.nickname);
  }
  return [...fresh, ...retry, ...stale].slice(0, limit);
}

/** 순위표에서 빠진 지 하루 지난 계정은 지워 캐시가 쌓이지 않게 함 */
export function pruneIds(ids, top, now) {
  const seen = new Set((top ?? []).map((r) => r.nickname));
  for (const [name, e] of Object.entries(ids)) {
    if (seen.has(name)) e.seen = now;
    else if (now - (e.seen ?? e.t) > RECHECK_MS) delete ids[name];
  }
}

/** asia1.json을 공식 순위표 대신 쓸 수 있으면 그 내용, 아니면 null */
export function usableAsia(data, seasonId, now) {
  if (!data || data.season !== seasonId || !data.active || !Array.isArray(data.topRanks)) return null;
  return now - data.at <= FRESH_MS ? data : null;
}
