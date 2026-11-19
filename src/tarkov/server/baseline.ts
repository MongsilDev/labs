import "server-only";
import { captureException } from "@sentry/node";
import { BADGE_RATES_SEED, combine, judge, MIN_N, shareOf, TARGET_PEERS, WIDTHS, type BadgeRates, type RateMode, type Sample, type Verdict, type VerdictPart } from "@/tarkov/lib/criteria";
import { seasonAt } from "@/tarkov/lib/kord";
import { MODES, type Mode } from "@/tarkov/lib/modes";
import { modeSample, toSample } from "@/tarkov/lib/sample";
import { parse, type Summary } from "@/tarkov/lib/summary";
import { db, getMeta, setMeta } from "./db";
import { fetchProfile, Upstream } from "./upstream";

// 최근 30일 안에 갱신된 계정을 천천히 받아 비교군을 만듦. 숫자만 저장
// 아레나는 계정 합계 행과 함께 mode 열이 arena/<모드 키>인 모드별 행을 둠. 모드별 행의 hours는 0
export const WINDOW = 30 * 24 * 60 * 60 * 1000;
const PEER_LIMIT = 2000;
const ARENA_PREFIX = "arena/";

// 시즌 모드는 규칙이 시즌마다 달라 지금 시즌이 시작한 뒤 갱신된 계정만 비교군에 씀
const since = (key: string, now = Date.now()) => (key === "season" ? seasonAt(now).start : 0);

function save(key: string, aid: number, updated: number, s: Sample) {
  db()
    .prepare(
      `INSERT INTO baseline (mode, aid, updated, hours, n, kills, deaths, survived, streak, headshots, max_game_kills)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(mode, aid) DO UPDATE SET updated = excluded.updated, hours = excluded.hours, n = excluded.n, kills = excluded.kills,
         deaths = excluded.deaths, survived = excluded.survived, streak = excluded.streak, headshots = excluded.headshots, max_game_kills = excluded.max_game_kills`,
    )
    .run(key, aid, updated, s.hours, s.n, s.kills, s.deaths, s.survived, s.streak, s.headshots, s.maxGameKills);
}

function candidates(mode: Mode, limit: number): { aid: number; u: number }[] {
  const col = `u_${mode.key}`;
  return db()
    .prepare(
      `SELECT a.aid AS aid, a.${col} AS u FROM accounts a
       LEFT JOIN baseline b ON b.mode = ? AND b.aid = a.aid
       WHERE a.${col} >= ? AND (b.updated IS NULL OR b.updated < a.${col}) AND a.aid NOT IN (SELECT aid FROM hidden)
       ORDER BY a.${col} DESC LIMIT ?`,
    )
    .all(mode.key, Date.now() - WINDOW, limit) as { aid: number; u: number }[];
}

const g = globalThis as unknown as { __tlCrawling?: boolean; __tlRates?: boolean; __tlRatesCache?: { raw: string; v: BadgeRates } };

export async function crawl(): Promise<number> {
  if (g.__tlCrawling) return 0;
  g.__tlCrawling = true;
  let done = 0;
  let fails = 0;
  try {
    // 모드를 번갈아 조금씩 받아 한 모드의 수집이 오래 지연되지 않게 함
    for (;;) {
      let any = false;
      for (const mode of MODES) {
        const batch = candidates(mode, 50);
        if (!batch.length) continue;
        any = true;
        for (const c of batch) {
          try {
            const raw = await fetchProfile(mode.folder, c.aid, "crawl");
            const sum = raw ? parse(mode.folder, raw) : null;
            const s = sum ? toSample(sum) : null;
            // 받지 못한 계정도 같은 갱신 시각으로 표시해 다시 고르지 않음
            save(mode.key, c.aid, c.u, s ?? { hours: 0, n: 0, kills: 0, deaths: 0, survived: 0, streak: 0, headshots: 0, maxGameKills: 0 });
            if (sum?.kind === "arena") {
              for (const m of sum.modes) save(ARENA_PREFIX + m.key, c.aid, c.u, modeSample(m.stats));
              // 모드 기록이 없는 계정도 표시 행을 남겨 모드별 재수집 대상에서 뺌
              if (!sum.modes.length) save(ARENA_PREFIX + "-", c.aid, c.u, { hours: 0, n: 0, kills: 0, deaths: 0, survived: 0, streak: 0, headshots: 0, maxGameKills: 0 });
            }
            done++;
          } catch (e) {
            fails++;
            if (e instanceof Upstream && (e.status === 429 || e.status >= 500)) await new Promise((r) => setTimeout(r, 60_000));
            if (fails >= 20) throw e;
          }
        }
      }
      if (!any) break;
    }
    if (done) console.log(`[비교군] ${done}건 수집`);
  } catch (e) {
    console.error("[비교군] 중단", e);
    captureException(e);
  } finally {
    g.__tlCrawling = false;
  }
  return done;
}

export function peers(key: string, aid: number, s: Sample): { rows: Sample[]; width: number } {
  const q = db().prepare(
    `SELECT hours, n, kills, deaths, survived, streak, headshots, max_game_kills AS maxGameKills FROM baseline
     WHERE mode = ? AND aid != ? AND n > 0 AND updated >= ? AND hours BETWEEN ? AND ? AND n BETWEEN ? AND ? LIMIT ?`,
  );
  const from = since(key);
  let last: Sample[] = [];
  for (const w of WIDTHS) {
    last = q.all(key, aid, from, s.hours * (1 - w), s.hours * (1 + w), Math.floor(s.n * (1 - w)), Math.ceil(s.n * (1 + w)), PEER_LIMIT) as Sample[];
    if (last.length >= TARGET_PEERS) return { rows: last, width: w };
  }
  return { rows: last, width: WIDTHS[WIDTHS.length - 1] };
}

export function verdict(mode: Mode, aid: number, sum: Summary | null): Verdict {
  if (sum?.kind === "arena") {
    // 모드마다 킬 빈도가 달라 같은 모드를 비슷한 경기 수만큼 한 계정끼리 비교
    const parts = sum.modes
      .filter((m) => m.stats.games >= MIN_N)
      .map((m) => {
        const s = modeSample(m.stats);
        const { rows, width } = peers(ARENA_PREFIX + m.key, aid, s);
        return { key: m.key, games: m.stats.games, v: judge("arena", s, rows, width) };
      });
    return combine(parts);
  }
  const s = sum ? toSample(sum) : null;
  if (!s) return { state: "none", reason: "missing" };
  const { rows, width } = peers(mode.key, aid, s);
  return judge("eft", s, rows, width);
}

export function baselineCounts(): Record<string, number> {
  const rows = db().prepare(`SELECT mode, COUNT(*) AS c FROM baseline WHERE n > 0 AND mode NOT LIKE '${ARENA_PREFIX}%' AND (mode != 'season' OR updated >= ?) GROUP BY mode`).all(since("season")) as { mode: string; c: number }[];
  return Object.fromEntries(rows.map((r) => [r.mode, r.c]));
}

const RATES_KEY = "badge_rates";
const COLS = "aid, hours, n, kills, deaths, survived, streak, headshots, max_game_kills AS maxGameKills";
type Row = Sample & { aid: number };

export function badgeRates(): BadgeRates {
  const raw = getMeta(RATES_KEY);
  if (!raw) return BADGE_RATES_SEED;
  if (g.__tlRatesCache?.raw !== raw) g.__tlRatesCache = { raw, v: JSON.parse(raw) as BadgeRates };
  return g.__tlRatesCache.v;
}

// 계정 하나에 비교군 조회와 판정이 최대 20ms쯤 걸려 5개마다 이벤트 루프에 양보
const pause = () => new Promise((r) => setImmediate(r));

const kst = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000);

// 비교군 계정 전체에 판정을 돌려 배지별 비율을 저장. 1분 남짓 걸려 이용자가 적은 오전 5시(KST) 뒤 하루 한 번
export async function refreshRates(): Promise<void> {
  if (g.__tlRates) return;
  const last = getMeta(RATES_KEY);
  const now = kst(Date.now());
  if (last && (now.getUTCHours() < 5 || kst((JSON.parse(last) as BadgeRates).at).toISOString().slice(0, 10) === now.toISOString().slice(0, 10))) return;
  g.__tlRates = true;
  try {
    const modes = {} as Record<RateMode, BadgeRates["modes"][RateMode]>;
    for (const key of ["pvp", "season", "pve"] as const) {
      const rows = db().prepare(`SELECT ${COLS} FROM baseline WHERE mode = ? AND n > 0 AND updated >= ?`).all(key, since(key)) as Row[];
      const states: Verdict["state"][] = [];
      for (let i = 0; i < rows.length; i++) {
        if (i % 5 === 0) await pause();
        const { rows: p, width } = peers(key, rows[i].aid, rows[i]);
        states.push(judge("eft", rows[i], p, width).state);
      }
      modes[key] = shareOf(states);
    }
    // 아레나는 계정마다 모드별 판정을 합친 배지
    const keys = (db().prepare(`SELECT DISTINCT mode FROM baseline WHERE mode LIKE '${ARENA_PREFIX}%' AND mode != '${ARENA_PREFIX}-'`).all() as { mode: string }[]).map((r) => r.mode);
    const parts = new Map<number, VerdictPart[]>();
    for (const key of keys) {
      const rows = db().prepare(`SELECT ${COLS} FROM baseline WHERE mode = ? AND n >= ?`).all(key, MIN_N) as Row[];
      for (let i = 0; i < rows.length; i++) {
        if (i % 5 === 0) await pause();
        const { rows: p, width } = peers(key, rows[i].aid, rows[i]);
        parts.set(rows[i].aid, [...(parts.get(rows[i].aid) ?? []), { key, games: rows[i].n, v: judge("arena", rows[i], p, width) }]);
      }
    }
    modes.arena = shareOf([...parts.values()].map((ps) => combine(ps).state));
    setMeta(RATES_KEY, JSON.stringify({ at: Date.now(), modes }));
    console.log(`[배지 비율] 갱신 PvP 높은 수치 ${modes.pvp.warn}%, 이상 수치 ${modes.pvp.alert}%`);
  } catch (e) {
    console.error("[배지 비율] 실패", e);
    captureException(e);
  } finally {
    g.__tlRates = false;
  }
}
