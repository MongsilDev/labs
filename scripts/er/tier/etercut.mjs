// 몽실봇 utils/rank_history.py와 commands/rating.py의 이터컷 계산을 옮김. 상태 파일은 몽실봇 data/rank_history.json과 같은 모양이라 그대로 복사해 이어 씀
// 시각은 모두 초 단위 유닉스 시각. 계산 근거와 백테스트 설명은 몽실봇 원본 주석에 있음
import { appendFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";

export const INTERVAL = 3600;
const KEEP_RANKS = 49 * 3600;
const KEEP_CUTS = 120 * 86400;
const KEEP_PLAYERS = 14 * 86400;
export const DORMANT_DAYS = 7;
export const GRACE = 12;
const GRACE_CAPS = [
  [300, 8],
  [1000, 10],
];
const KST = 9 * 3600;
const DAY = 86400;
/** KST 날짜 번호(1970-01-01이 0)와 그날 hour시의 유닉스 시각 */
const kstDay = (t) => Math.floor((t + KST) / DAY);
const dayAt = (d, hour) => d * DAY + hour * 3600 - KST;
const ymd = (d) => new Date(d * DAY * 1000).toISOString().slice(0, 10);
export const GRACE_FROM = dayAt(Date.UTC(2026, 9, 29) / 1000 / DAY, 15);
// 정기 점검은 2026-08-20(12.2)부터 격주 목요일
const PATCH_ANCHOR = Date.UTC(2026, 7, 20) / 1000 / DAY;
export const DECAY_FLOOR = 6400;
const ALPHA = 0.5;
const BETA = 0.2;
const DAMP = 0.95;
export const SURGE = { 300: [232, 116, 267], 1000: [114, 52, 203] };
const SURGE_LEFT = [
  [0, 1.0],
  [1, 0.83],
  [3, 0.59],
  [4.5, 0.37],
  [7, 0.18],
  [9, 0.1],
  [14, 0.0],
];
export const RANKED_GATE = 8300;
export const [MMR, CHANGED, FIRST, SEEN, LAST_GAME, CHECKED, UID] = [0, 1, 2, 3, 4, 5, 6];
export const NO_RECENT = 0;
export const UNREADABLE = -1;

/** 파이썬 round와 같은 은행원 반올림. 원본과 값을 맞추려고 씀 */
export function pyRound(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

export function loadState(path) {
  let s = {};
  try {
    s = JSON.parse(readFileSync(path, "utf8"));
  } catch {}
  s.ranks ??= [];
  s.cuts ??= [];
  s.players ??= {};
  return s;
}

export function saveState(path, state) {
  writeFileSync(`${path}.tmp`, JSON.stringify(state));
  renameSync(`${path}.tmp`, path);
}

const sameHour = (a, b) => Math.floor(a / INTERVAL) === Math.floor(b / INTERVAL);

/** 상위 100명 순위. 몽실봇은 직전 기록 뒤 한 시간이 지나야 남겼으나 정각 회차라 같은 시간대면 건너뜀 */
export function recordRanks(state, seasonId, topRanks, now) {
  const ranks = state.ranks.filter((r) => r[1] === seasonId && now - r[0] < KEEP_RANKS);
  if (ranks.length && sameHour(now, ranks.at(-1)[0])) return;
  ranks.push([now, seasonId, Object.fromEntries(topRanks.slice(0, 100).filter((r) => r.nickname).map((r) => [r.nickname, r.rank]))]);
  state.ranks = ranks;
}

/** 24시간 전에 가장 가까운 20~28시간 전 기록 */
export function ranksDayAgo(state, seasonId, now) {
  const old = state.ranks.filter((r) => r[1] === seasonId && 20 * 3600 <= now - r[0] && now - r[0] <= 28 * 3600);
  if (!old.length) return null;
  return old.reduce((a, b) => (Math.abs(now - b[0] - DAY) < Math.abs(now - a[0] - DAY) ? b : a))[2];
}

/** 컷 기록과 순위 스냅숏. rps는 순위 순서의 상위 RP 전체 */
export function recordCuts(state, seasonId, cuts, now, snapshots, rps) {
  const [eternity, demigod, activeEternity, activeDemigod] = cuts;
  if (!eternity && !demigod) return;
  const kept = state.cuts.filter((c) => now - c[0] < KEEP_CUTS);
  const mine = kept.filter((c) => c[1] === seasonId);
  if (mine.length && sameHour(now, mine.at(-1)[0])) return;
  kept.push([now, seasonId, eternity ?? null, demigod ?? null, activeEternity ?? null, activeDemigod ?? null]);
  state.cuts = kept;
  if (snapshots && rps?.length) appendFileSync(snapshots, JSON.stringify({ t: pyRound(now), s: seasonId, rp: rps }) + "\n");
}

/** 기록마다 [시각, 이터니티, 데미갓, 휴면 강등 이터니티, 휴면 강등 데미갓] 순서로 돌려줌 */
export function cutHistory(state, seasonId) {
  return state.cuts.filter((c) => c[1] === seasonId).map((c) => [c[0], c[2], c[3], c[4] ?? null, c[5] ?? null]);
}

/** 닉네임별 [RP, 마지막 변화, 처음 본 시각, 마지막으로 본 시각, 마지막 랭크 게임, 확인 시각, uid] */
export function recordPlayers(state, seasonId, topRanks, now) {
  let book = state.players;
  if (book.season !== seasonId) book = state.players = { season: seasonId, at: 0, since: now, list: {} };
  if (sameHour(now, book.at)) return;
  const players = book.list;
  for (const r of topRanks) {
    const name = r.nickname;
    const mmr = r.mmr;
    if (!name || mmr == null) continue;
    const old = players[name];
    if (!old) {
      players[name] = [Math.trunc(mmr), now, now, now, null, null, null];
      continue;
    }
    while (old.length < UID + 1) old.push(null);
    const delta = Math.trunc(mmr) - old[MMR];
    if (delta) {
      // 휴면 차감은 하루 100점. 게임으로 바뀐 RP만 활동으로 간주
      if (!(delta < 0 && delta % 100 === 0)) old[CHANGED] = now;
      old[MMR] = Math.trunc(mmr);
    }
    old[SEEN] = now;
  }
  for (const [name, p] of Object.entries(players)) if (now - p[SEEN] > KEEP_PLAYERS) delete players[name];
  book.at = now;
}

export function playerBook(state, seasonId) {
  const book = state.players;
  if (book.season !== seasonId) return {};
  for (const p of Object.values(book.list)) {
    while (p.length < UID + 1) p.push(null);
    if (book.v !== 2 && p[LAST_GAME] === NO_RECENT) p[LAST_GAME] = p[CHECKED] = null;
  }
  book.v = 2;
  return book.list;
}

export function lastActive(p) {
  const seen = p[CHANGED] > p[FIRST] ? [p[CHANGED]] : [];
  if (p.length > LAST_GAME && p[LAST_GAME] != null) {
    if (p[LAST_GAME] === UNREADABLE) seen.push(p[CHECKED]);
    else if (p[LAST_GAME] > 0) seen.push(p[LAST_GAME]);
    else seen.push(0);
  }
  return seen.length ? Math.max(...seen) : null;
}

/** RP 변화로 최근 활동을 아는 계정은 건너뜀. 모르면 확인, 휴면으로 판단한 계정은 하루마다 다시 확인 */
export function needsCheck(p, now) {
  const at = lastActive(p);
  if (at != null && now - at <= DORMANT_DAYS * DAY) return false;
  if (p[CHECKED] == null) return true;
  return now - p[CHECKED] > (p[LAST_GAME] != null ? DAY : 1800);
}

export function graceCap(rank, now) {
  if (now < GRACE_FROM) return GRACE;
  return GRACE_CAPS.find(([place]) => rank <= place)?.[1] ?? GRACE;
}

/** 마지막 랭크 게임 뒤 until까지 휴면 강등으로 100점씩 깎인 횟수 */
export function decayTicks(last, until, cap = GRACE) {
  let d = kstDay(last);
  if (dayAt(d, 5) <= last) d += 1;
  let grace = GRACE;
  let ticks = 0;
  for (;;) {
    d += 1;
    const at = dayAt(d, 15);
    if (at >= until) break;
    // 1970-01-01이 목요일이라 날짜 번호가 7의 배수면 목요일
    if (d % 7 === 0 && (d - PATCH_ANCHOR) % 14 === 0) continue;
    if (at >= GRACE_FROM) grace = Math.min(grace, cap);
    if (grace) grace -= 1;
    else ticks += 1;
  }
  return ticks;
}

export function projectedRp(p, mmr, now, end, cap = GRACE) {
  let at = lastActive(p);
  if (at == null) return null;
  if (now - at <= DORMANT_DAYS * DAY || end <= now) return mmr;
  at = at > 0 ? at : now - 60 * DAY;
  return Math.max(mmr - 100 * (decayTicks(at, end, cap) - decayTicks(at, now, cap)), Math.min(mmr, DECAY_FLOOR));
}

/** API 순위는 RP 순서와 어긋나는 계정이 있어 컷은 RP 순서로 읽음 */
export function byRp(topRanks) {
  return topRanks.filter((r) => r.mmr).sort((a, b) => Math.trunc(b.mmr) - Math.trunc(a.mmr));
}

/** 휴면 계정을 end까지 강등된 RP로 다시 정렬한 place번째 RP, 그 위에서 내려간 휴면 계정 수, 추정 여부. 판별 안 된 계정이 20명 넘으면 null */
export function activeCut(state, seasonId, topRanks, place, end, now) {
  const players = playerBook(state, seasonId);
  const book = state.players;
  const firsts = Object.values(players).map((p) => p[FIRST]);
  const since = book.since || (firsts.length ? Math.min(...firsts) : 0);
  end = end || now;
  const ranked = byRp(topRanks);
  if (ranked.length < 200) return null;
  let unknown = 0;
  const scores = [];
  for (const r of ranked) {
    const mmr = Math.trunc(r.mmr);
    const p = players[r.nickname];
    let value = p ? projectedRp(p, mmr, now, end, graceCap(r.rank ?? 0, now)) : null;
    if (value == null) {
      if (p && p[FIRST] - since < 3600) {
        unknown += 1;
        if (unknown > 20) return null;
      }
      value = mmr;
    }
    scores.push([value, mmr]);
  }
  const last = Math.trunc(ranked.at(-1).mmr);
  const kept = scores
    .map(([v]) => v)
    .filter((v) => v >= last)
    .sort((a, b) => b - a);
  const dropped = (cut) => scores.filter(([v, mmr]) => v < cut && cut <= mmr).length;
  if (kept.length >= place) {
    const value = kept[place - 1];
    return [value, dropped(value), false];
  }
  // 순위표는 위에서부터 빠짐없이 있으므로 마지막 RP가 문턱 아래면 place번째도 그 아래여서 컷은 문턱으로 정해짐
  if (last < RANKED_GATE) return [RANKED_GATE, dropped(RANKED_GATE), false];
  const window = ranked.slice(-100);
  const perRank = (Math.trunc(window[0].mmr) - last) / (window.length - 1);
  const activeShare = scores.slice(-100).filter(([v]) => v >= last).length / 100;
  if (activeShare <= 0) return null;
  const value = pyRound(last - (perRank * (place - kept.length)) / activeShare);
  return [value, dropped(value), true];
}

/** cut 위의 휴면 계정이 cut 아래로 내려가는 날(KST)별 인원과 시즌 끝까지 안 내려가는 인원 */
export function decaySchedule(state, seasonId, topRanks, cut, end, now) {
  const players = playerBook(state, seasonId);
  const days = new Map();
  let stay = 0;
  for (const r of topRanks) {
    const p = players[r.nickname];
    const mmr = Math.trunc(r.mmr || 0);
    let at = p ? lastActive(p) : null;
    if (mmr < cut || at == null || now - at <= DORMANT_DAYS * DAY) continue;
    at = at > 0 ? at : now - 60 * DAY;
    const cap = graceCap(r.rank ?? 0, now);
    // 차감은 15시라 날마다 16시에 확인
    let d = kstDay(now);
    if (dayAt(d, 16) <= now) d += 1;
    const base = decayTicks(at, now, cap);
    let fell = false;
    for (; dayAt(d, 16) <= end; d += 1) {
      if (Math.max(mmr - 100 * (decayTicks(at, dayAt(d, 16), cap) - base), Math.min(mmr, DECAY_FLOOR)) < cut) {
        days.set(ymd(d), (days.get(ymd(d)) ?? 0) + 1);
        fell = true;
        break;
      }
    }
    if (!fell) stay += 1;
  }
  return [[...days].sort((a, b) => (a[0] < b[0] ? -1 : 1)), stay];
}

/** 날마다 KST 오전 9시에 가장 가까운 기록. 앞뒤 90분 안에 기록이 없는 날은 뺌 */
export function atNine(history, index) {
  const days = new Map();
  for (const h of history) {
    if (!h[index]) continue;
    const nine = dayAt(kstDay(h[0]), 9);
    const gap = Math.abs(h[0] - nine);
    if (gap <= 5400 && (!days.has(nine) || gap < days.get(nine)[0])) days.set(nine, [gap, h[index]]);
  }
  return [...days].sort((a, b) => a[0] - b[0]).map(([d, [, v]]) => [d, v]);
}

function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function theilSen(values) {
  const slopes = [];
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) slopes.push((values[j] - values[i]) / (j - i));
  return median(slopes);
}

export function surgeShare(left) {
  for (let k = 0; k + 1 < SURGE_LEFT.length; k++) {
    const [a, x] = SURGE_LEFT[k];
    const [b, y] = SURGE_LEFT[k + 1];
    if (left <= b) return x + ((y - x) * (Math.max(left, a) - a)) / (b - a);
  }
  return 0;
}

/** 오전 9시 값의 감쇠 추세로 시즌 종료까지 날마다 오전 9시 값을 예상. 날마다 [시각, 가운데, 낮은 값, 높은 값]과 자르기 전 낮은 값 */
export function forecast(points, start, now, end, surge = [0, 0, 0], minDays = 7) {
  if (points.length < minDays || end <= now) return null;
  const values = points.map(([, v]) => v);
  let level = values[0];
  let trend = theilSen(values.slice(0, 7));
  for (const v of values.slice(1)) {
    const last = level;
    level = ALPHA * v + (1 - ALPHA) * (level + DAMP * trend);
    trend = BETA * (level - last) + (1 - BETA) * DAMP * trend;
  }
  const [midS, lowS, highS] = surge;
  const done = surgeShare((end - now) / DAY);
  const future = [];
  const rawLow = [];
  let day = dayAt(kstDay(now), 9);
  if (day <= now) day += DAY;
  for (; day <= end; day += DAY) {
    const h = (day - now) / DAY;
    const c = Math.ceil(h);
    let sum = 0;
    for (let k = 1; k <= c; k++) sum += DAMP ** k;
    const base = start + (trend * sum * h) / c;
    const share = Math.max(surgeShare((end - day) / DAY) - done, 0);
    const half = 6.2 * h ** 0.75;
    future.push([day, base + share * midS, Math.max(base - half + share * lowS, start), base + half + share * highS]);
    rawLow.push(base - half + share * lowS);
  }
  return future.length ? { future, rawLow } : null;
}

const GATE_USER = { mmr: RANKED_GATE };
export const cutRp = (user) => (user ? Math.max(Math.trunc(user.mmr ?? 0), RANKED_GATE) : null);

/** 300위와 1000위 계정. 순위표가 그 순위까지 차지 않았으면 문턱 RP */
export function boardCuts(top, fresh) {
  if (Array.isArray(top) && !top.length && fresh) return [GATE_USER, GATE_USER];
  if (!top?.length) return [null, null];
  const ordered = byRp(top);
  if (!ordered.length) return [null, null];
  // 다시 만든 아시아1 순위표는 1,000명이 안 돼도 마지막 RP가 문턱 위일 수 있어, 그때 그 순위 값은 알 수 없음
  const at = (i) => ordered[i] ?? (Math.trunc(ordered.at(-1).mmr) < RANKED_GATE ? GATE_USER : null);
  return [at(299), at(999)];
}

/** 순위표를 받은 직후 몽실봇 fetch_ranking_data와 fetch_rating_info가 남기던 기록을 모두 남김 */
export function record(state, { seasonId, top, fresh, end, now, snapshots }) {
  if (top?.length) {
    recordRanks(state, seasonId, top, now);
    recordPlayers(state, seasonId, top, now);
  }
  const [r300, r1000] = boardCuts(top, fresh);
  if (!r300) return;
  const active = [300, 1000].map((place) => activeCut(state, seasonId, top ?? [], place, end, now));
  const rps = [...(top ?? [])].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).filter((r) => r.mmr).map((r) => Math.trunc(r.mmr));
  recordCuts(state, seasonId, [cutRp(r300), cutRp(r1000), ...active.map((a) => (a ? Math.max(a[0], RANKED_GATE) : null))], now, snapshots, rps);
}

/** 티어마다 [순위, 순위표 컷, 기록 열, 휴면 강등 컷 결과, 표시 컷, 종료 예상] */
export function tierCuts(state, seasonId, ranked, history, end, eternity, demigod, now) {
  return [
    [300, eternity, 1],
    [1000, demigod, 2],
  ].map(([place, rp, official]) => {
    const found = seasonId && ranked.length ? activeCut(state, seasonId, ranked, place, end, now) : null;
    const start = found ? Math.max(found[0], RANKED_GATE) : rp;
    const outlook = start && end ? forecast(atNine(history, official), start, now, end, SURGE[place]) : null;
    return { place, rp, official, found, start, outlook };
  });
}

/** 몽실봇 /api/cut과 같은 모양. 휴면 계정은 인원만 내보냄. 순위표를 받지 못했으면 null */
export function snapshot(state, { seasonId, seasonName, top, fresh, end, now }) {
  const ranked = (top ?? []).filter((r) => r.mmr);
  if (!ranked.length && !(Array.isArray(top) && !top.length && fresh)) return null;
  const [r300, r1000] = boardCuts(top, fresh);
  const history = cutHistory(state, seasonId);
  const tiers = {};
  const keys = ["eternity", "demigod"];
  tierCuts(state, seasonId, ranked, history, end, cutRp(r300), cutRp(r1000), now).forEach(({ place, rp, official, found, start, outlook }, i) => {
    const board = new Map(atNine(history, official).map(([t, v]) => [pyRound(t), v]));
    const adjusted = new Map(atNine(history, official + 2).map(([t, v]) => [pyRound(t), v]));
    const days = [...board.keys()].sort((a, b) => a - b).slice(-30);
    const [schedule, stay] = end && start ? decaySchedule(state, seasonId, ranked, start, end, now) : [[], 0];
    tiers[keys[i]] = {
      place,
      board: rp,
      cut: start,
      estimated: Boolean(found && found[2]),
      dropped: found ? found[1] : null,
      history: days.map((t) => [t, board.get(t), adjusted.get(t) ?? null]),
      forecast: outlook ? outlook.future.map(([t, m, lo, hi], k) => [pyRound(t), pyRound(m), pyRound(lo), pyRound(hi), pyRound(outlook.rawLow[k])]) : null,
      decay: schedule,
      decayStay: stay,
    };
  });
  const places = [
    ["eternity", 300],
    ["demigod", 1000],
    ["default", 1001],
  ];
  return {
    updatedAt: pyRound(now),
    season: { id: seasonId, name: seasonName, end: end ? pyRound(end) : null },
    rps: byRp(ranked).map((r) => Math.trunc(r.mmr)),
    tiers,
    quitTicks: end ? Object.fromEntries(places.map(([k, place]) => [k, decayTicks(now, end, graceCap(place, now))])) : null,
    rule: {
      grace: Object.fromEntries(places.map(([k, place]) => [k, graceCap(place, GRACE_FROM)])),
      graceFrom: pyRound(GRACE_FROM),
      step: 100,
      floor: DECAY_FLOOR,
      dormantDays: DORMANT_DAYS,
    },
  };
}

const SEASON_ZERO_ID = 19;
const SEASON_NAME_OFFSET = 9;
const FRESH_DAYS = 3;
const parseKst = (s) => {
  if (!s) return null;
  const t = Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(" ", "T").replaceAll("/", "-")}+09:00`);
  return Number.isNaN(t) ? null : t / 1000;
};

export function seasonName(id, raw) {
  if (id <= SEASON_ZERO_ID) return `EA 시즌 ${id}`;
  const m = /^(Pre-)?Season(\d+)$/.exec(raw ?? "");
  if (!m) return raw;
  return `${m[1] ? "프리 시즌" : "정규 시즌"} ${Number(m[2]) - SEASON_NAME_OFFSET}`;
}

/** 공식 Season 목록에서 랭크 시즌을 고름. 몽실봇 get_ranked_season, season_end_for, fresh_season과 같은 규칙
 * 시작 시각에 바로 넘어가려고 기간으로 먼저 찾고(isCurrent는 늦게 바뀜), 프리 시즌이면 직전 정규 시즌을 쓰며 종료 시각은 붙이지 않음 */
export function rankedSeason(list, now) {
  const rows = list.filter((s) => s && typeof s === "object" && "seasonID" in s);
  const inPeriod = (s) => {
    const start = parseKst(s.seasonStart);
    const end = parseKst(s.seasonEnd);
    return start != null && end != null && start <= now && now < end;
  };
  const current = rows.find(inPeriod) ?? rows.find((s) => s.isCurrent === 1) ?? rows.reduce((a, b) => (!a || b.seasonID > a.seasonID ? b : a), null);
  if (!current) return null;
  let ranked = current;
  if (String(current.seasonName ?? "").startsWith("Pre-Season")) {
    for (let id = current.seasonID - 1; id > SEASON_ZERO_ID; id--) {
      const prev = rows.find((s) => s.seasonID === id);
      if (prev && !String(prev.seasonName ?? "").startsWith("Pre-Season")) {
        ranked = prev;
        break;
      }
    }
  }
  const start = parseKst(current.seasonStart);
  let end = parseKst(current.seasonEnd);
  if (end == null && start != null && String(current.seasonName ?? "").startsWith("Pre-Season")) end = start + 7 * DAY;
  const same = ranked.seasonID === current.seasonID;
  return {
    id: ranked.seasonID,
    name: seasonName(ranked.seasonID, ranked.seasonName ?? ""),
    end: same ? end : null,
    fresh: same && start != null && now - start < FRESH_DAYS * DAY,
  };
}
