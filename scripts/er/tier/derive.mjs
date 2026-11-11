// 수집기가 저장한 경기 원본으로 RP 손익, 초반과 막판 집계를 만듦. 공식 API에는 요청하지 않음
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { brotliDecompressSync } from "node:zlib";

export const BANDS = [[7000, 8000], [8000, 8400], [8400, 8800], [8800, 9200], [9200, 99999]];
export const TK = [[0, 3], [4, 7], [8, 11], [12, 15], [16, 99]];
// 13분 안에 4위 밖으로 끝난 경기를 초반 탈락으로 셈
export const EARLY_S = 780;
const MIN_SIZE = 21;
const LATE_MIN_N = 300;
const LATE_MIN_TOP3 = 60;

const stat = () => ({ n: 0, s: 0, q: 0 });
const put = (a, v) => {
  a.n++;
  a.s += v;
  a.q += v * v;
};
const mean = (a) => a.s / a.n;
const ci95 = (a) => 1.96 * Math.sqrt(Math.max(0, (a.q - a.n * mean(a) ** 2) / (a.n - 1)) / a.n);
const fix1 = (v) => +v.toFixed(1);
const cell = (a) => (a.n < 2 ? { n: a.n, m: null, ci: null } : { n: a.n, m: Math.round(mean(a)), ci: fix1(ci95(a)) });
const pct = (v) => fix1(v * 100);
const pctCi = (p, n) => fix1(1.96 * Math.sqrt((p * (1 - p)) / n) * 100);

/** games는 { t, body } 행. body는 brotli로 묶은 참가자 배열. 지금 패치의 아시아 랭크 경기만 셈 */
export function derive(games, tier) {
  const [, major, minor = 0] = String(tier?.patch ?? "").split(".").map(Number);
  if (!Number.isInteger(major)) return null;
  const bands = BANDS.map(([lo, hi]) => ({
    lo,
    hi,
    entry: stat(),
    tk: stat(),
    cells: Array.from({ length: 8 }, () => TK.map(stat)),
    hours: Array.from({ length: 24 }, stat),
  }));
  const combos = new Map();
  const all = { n: 0, early: 0, top3: 0, win: 0 };
  let count = 0, rows = 0, from = Infinity, to = 0;
  for (const g of games) {
    const a = JSON.parse(brotliDecompressSync(g.body));
    const p0 = a[0];
    if (!p0 || p0.matchingMode !== 3 || p0.versionMajor !== major || (p0.versionMinor ?? 0) !== minor) continue;
    if ((p0.matchSize ?? a.length) < MIN_SIZE || !/Asia/i.test(p0.serverName ?? "")) continue;
    count++;
    from = Math.min(from, g.t);
    to = Math.max(to, g.t);
    for (const p of a) {
      rows++;
      const rank = p.gameRank;
      const key = `${p.characterNum}-${p.bestWeapon}`;
      const e = combos.get(key) ?? { n: 0, early: 0, top3: 0, win: 0 };
      for (const x of [e, all]) {
        x.n++;
        if (rank > 3 && typeof p.duration === "number" && p.duration <= EARLY_S) x.early++;
        if (rank <= 3) x.top3++;
        if (rank === 1) x.win++;
      }
      combos.set(key, e);
      const b = bands.find((x) => p.mmrBefore >= x.lo && p.mmrBefore < x.hi);
      if (!b || typeof p.mmrGain !== "number") continue;
      put(b.entry, p.mmrLossEntryCost ?? 0);
      put(b.tk, p.teamKill ?? 0);
      const k = TK.findIndex(([lo, hi]) => p.teamKill >= lo && p.teamKill <= hi);
      if (rank >= 1 && rank <= 8 && k >= 0) put(b.cells[rank - 1][k], p.mmrGain);
      const hh = String(p.startDtm ?? "").slice(11, 13);
      if (/^\d\d$/.test(hh) && Number(hh) < 24) put(b.hours[Number(hh)], p.mmrGain);
    }
  }
  if (!count || !all.top3) return null;
  const names = new Map();
  for (const v of [...(tier.views ?? []), ...(tier.past?.views ?? [])])
    for (const c of v.combos ?? []) names.set(`${c.char}-${c.weapon}`, { char: c.char, weapon: c.weapon, key: c.key, name: c.name, weaponName: c.weaponName });
  const late = [];
  for (const [key, e] of combos) {
    const meta = names.get(key);
    if (!meta || e.n < LATE_MIN_N || e.top3 < LATE_MIN_TOP3) continue;
    const early = e.early / e.n, fin = e.win / e.top3;
    late.push({ ...meta, n: e.n, top3: e.top3, early: pct(early), earlyCi: pctCi(early, e.n), fin: pct(fin), finCi: pctCi(fin, e.top3) });
  }
  return {
    rp: {
      from,
      to,
      games: count,
      rows,
      tk: TK,
      bands: bands.map((b) => ({
        lo: b.lo,
        hi: b.hi,
        n: b.entry.n,
        entry: b.entry.n ? Math.round(mean(b.entry)) : 0,
        tkAvg: b.tk.n ? fix1(mean(b.tk)) : 0,
        cells: b.cells.map((row) => row.map(cell)),
        hours: b.hours.map((a, h) => ({ h, gain: a.n < 2 ? 0 : fix1(mean(a)), ci: a.n < 2 ? 0 : fix1(ci95(a)), n: a.n })),
      })),
    },
    late: { from, to, games: count, cut: EARLY_S, early: pct(all.early / all.n), fin: pct(all.win / all.top3), rows: late },
  };
}

/** root는 labs 자료 폴더. 화면이 쓰는 도중의 파일을 읽지 않게 임시 파일에 쓴 뒤 이름을 바꿈 */
export function writeDerived(root, out) {
  if (!out) return false;
  for (const [dir, name, data] of [["er-rp", "rp.json", out.rp], ["er-late", "late.json", out.late]]) {
    mkdirSync(join(root, dir), { recursive: true });
    const tmp = join(root, dir, `.${name}.${process.pid}`);
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, join(root, dir, name));
  }
  return true;
}

// 직접 실행하면 원본을 읽기 전용으로 열어 집계만 다시 씀
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
  const out = process.env.TIER_OUT || join(homedir(), "docker/_data/labs/er-tier");
  const file = join(out, "tier.json");
  if (!existsSync(file)) throw new Error(`${file} 없음`);
  const tier = JSON.parse(readFileSync(file, "utf8"));
  const db = new DatabaseSync(join(dir, "raw.sqlite"), { readOnly: true });
  const res = derive(db.prepare("SELECT t, body FROM games WHERE season = ?").iterate(tier.season.id), tier);
  console.log(writeDerived(join(out, ".."), res) ? `경기 ${res.rp.games}, 행 ${res.rp.rows}, 조합 ${res.late.rows.length}` : "해당 경기 없음");
}
