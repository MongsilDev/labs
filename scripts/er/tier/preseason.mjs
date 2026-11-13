// 프리 시즌 특집 집계. 수집기가 preseason.sqlite에 모은 행만 읽고 공식 API에는 요청하지 않음
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RULE, scoreRows } from "./score.mjs";

// 합쳐 싣는 모드는 랭크와 일반. 코발트 프로토콜과 이벤트 모드에는 실험 과제가 없음
export const MODES = [3, 2];
// 코발트 프로토콜은 4인 두 팀 경기라 순위 대신 승패만 따로 셈
export const COBALT = 6;
// 승률을 전체 승률 쪽으로 당기는 가상의 판 수. 판 수가 적은 조합이 위아래 끝에 몰리지 않게 함
const COBALT_PRIOR = 100;
/**
 * 등급별 누적 비율. 프리 시즌 점수는 많이 고른 조합이 아래로 몰려 분포가 한쪽으로 치우쳐 있어,
 * 정규 티어의 표준편차 경계를 쓰면 S가 30%를 넘음. 그래서 점수 순위의 비율로 나눔
 */
export const GRADE_SHARE = [["S", 0.1], ["A", 0.3], ["B", 0.7], ["C", 0.9]];
// 순위의 가운데 값으로 나눠야 위아래 등급의 수가 같아짐
const gradeAt = (i, total) => GRADE_SHARE.find(([, upto]) => (i + 0.5) / total < upto)?.[0] ?? "D";
// RP와 플레이어 식별값을 저장하지 않아 정규 티어 계산에서 RP와 한 사람 몫 제한을 빼고 평균 순위와 TOP 3만 씀.
// mmr 자리에 경기의 팀 수를 넣어 7팀 경기와 8팀 경기의 순위 평균 차이를 구간 보정으로 뺌
export const TIER_RULE = { ...RULE, few: undefined, weights: { gain: 0, place: 0.5, top3: 0.5 }, bands: [8] };
// 실험체 줄은 이 판 수를 넘을 때만 보여 줌
export const CHAR_MIN = 30;
const CHANGE_TOP = 10;
export const TRIO_MIN = 30;
/** collect.mjs --pre-base가 직전 시즌 비교 경기를 끝까지 받으면 시즌 ID를 적는 파일 */
export const BASE_DONE = "pre-base.done";
export const baseReady = (dir, id) => existsSync(join(dir, BASE_DONE)) && readFileSync(join(dir, BASE_DONE), "utf8").trim() === String(id);
export const EXP = { Energy: "에너지 공학", Material: "재료 공학", Biotechnology: "생명 공학" };
// questStepClear의 experimentGroupId 앞자리. 실험 결과 분야와 맞춰 본 값이고 끝자리는 단계
const QUEST = { 1: "Material", 2: "Energy", 3: "Biotechnology" };
/** 13.0에 추가된 방어구. 펄스 자켓 202424, 제너레이터 202532, 제왕의 투구 201538, 아이보리 스텝 204515 */
export const NEW_ARMOR = [202424, 202532, 201538, 204515];
export const GRADE_KO = { Common: "일반", Uncommon: "고급", Rare: "희귀", Epic: "영웅", Legend: "전설", Mythic: "초월" };

const fix1 = (v) => +v.toFixed(1);
const pct = (k, n) => (n ? fix1((k / n) * 100) : 0);
const pctCi = (k, n) => (n ? fix1(1.96 * Math.sqrt(((k / n) * (1 - k / n)) / n) * 100) : 0);
const avg = (s, n) => (n ? +(s / n).toFixed(2) : null);
const acc = () => ({ n: 0, rank: 0, win: 0 });
const add = (a, rank) => {
  a.n++;
  a.rank += rank;
  if (rank === 1) a.win++;
};
const out = (a, total) => ({ n: a.n, share: pct(a.n, total), rank: avg(a.rank, a.n), win: pct(a.win, a.n), winCi: pctCi(a.win, a.n) });

function fresh() {
  return {
    games: 0, players: 0, bots: 0, teams: 0, winTeams: 0, from: Infinity, to: 0, servers: new Map(), modes: new Map(),
    exp: new Map(Object.keys(EXP).map((k) => [k, acc()])), none: acc(),
    chars: new Map(), combos: new Map(), trios: new Map(), weathers: new Map(), equipped: 0, equipGames: 0, equipLast: null, armor: new Map(),
    quest: new Map(Object.keys(EXP).map((k) => [k, { n1: 0, t1: 0, n2: 0, c2: 0 }])),
  };
}

/** 직전 정규 시즌 경기에서 조합별 판 수와 1위 수. 봇과 MODES 밖 경기는 뺌 */
function baseline(rows) {
  const b = { games: new Set(), teams: new Set(), from: Infinity, to: 0, players: 0, chars: new Map() };
  for (const r of rows) {
    if (!MODES.includes(r.mode) || r.bot) continue;
    b.games.add(r.game);
    b.teams.add(`${r.game}:${r.team}`);
    b.from = Math.min(b.from, r.t);
    b.to = Math.max(b.to, r.t);
    b.players++;
    const key = `${r.char}-${r.weapon}`;
    const a = b.chars.get(key) ?? acc();
    add(a, r.rank);
    b.chars.set(key, a);
  }
  return b;
}

/** rows는 preseason.sqlite rows 행을 game, slot 순서로. nm은 이름 찾기 함수 묶음, scan은 훑은 번호 수와 찾은 경기 수, baseRows는 직전 정규 시즌 비교 경기 */
export function derivePre(rows, season, nm, scan = null, baseRows = []) {
  const x = fresh();
  const tier = [];
  const cb = { games: 0, teams: 0, from: Infinity, to: 0, combos: new Map() };
  let game = null, m = null, w = null, teams = null, list = [];
  const flush = () => {
    // 팀 수는 봇 팀까지 세야 경기 규모가 맞음
    const size = new Set(list.map((r) => r.team)).size;
    for (const r of list) if (!r.bot) tier.push({ game: r.game, player: `${r.game}-${r.slot}`, char: r.char, weapon: r.weapon, rank: r.rank, gain: 0, mmr: size });
    // 3인 조합은 봇이 없는 세 명 팀만 셈. 실험체와 무기를 정렬한 키라 자리 순서와 관계없음
    const byTeam = new Map();
    for (const r of list) byTeam.set(r.team, [...(byTeam.get(r.team) ?? []), r]);
    for (const team of byTeam.values()) {
      if (team.length !== 3 || team.some((r) => r.bot)) continue;
      const key = team.map((r) => `${r.char}-${r.weapon}`).sort().join("+");
      const a = x.trios.get(key) ?? { ...acc(), t3: 0 };
      add(a, team[0].rank);
      if (team[0].rank <= 3) a.t3++;
      x.trios.set(key, a);
    }
    list = [];
  };
  for (const r of rows) {
    if (r.game !== game) {
      flush();
      game = r.game;
      m = MODES.includes(r.mode) ? x : null;
      teams = new Set();
      if (r.mode === COBALT) {
        cb.games++;
        cb.from = Math.min(cb.from, r.t);
        cb.to = Math.max(cb.to, r.t);
      }
      if (m) {
        m.games++;
        m.modes.set(r.mode, (m.modes.get(r.mode) ?? 0) + 1);
        m.servers.set(r.server, (m.servers.get(r.server) ?? 0) + 1);
        m.from = Math.min(m.from, r.t);
        m.to = Math.max(m.to, r.t);
        w = m.weathers.get(r.weather) ?? { games: 0, players: 0, drop: 0, buff: null };
        w.games++;
        m.weathers.set(r.weather, w);
      }
    }
    if (r.mode === COBALT && !r.bot) {
      if (!teams.has(r.team)) {
        teams.add(r.team);
        cb.teams++;
      }
      const key = `${r.char}-${r.weapon}`;
      const a = cb.combos.get(key) ?? acc();
      add(a, r.rank);
      cb.combos.set(key, a);
    }
    if (!m) continue;
    list.push(r);
    // 봇 기록은 플레이어와 팀 지표에서 뺌
    if (r.bot) {
      m.bots++;
      continue;
    }
    const rank = r.rank;
    if (!teams.has(r.team)) {
      teams.add(r.team);
      m.teams++;
      if (rank === 1) m.winTeams++;
      add(m.exp.get(r.exp) ?? m.none, rank);
      // 단계 기록은 팀원 모두 같아 팀마다 한 번만 셈
      for (const [group, sec, count] of JSON.parse(r.quest || "[]")) {
        const q = m.quest.get(QUEST[Math.floor(group / 10000)]);
        if (!q) continue;
        if (group % 10 === 1) {
          q.n1++;
          q.t1 += sec;
        } else if (group % 10 === 2) {
          q.n2++;
          q.c2 += count;
        }
      }
    }
    m.players++;
    const key = `${r.char}-${r.weapon}`;
    const c = m.chars.get(key) ?? { n: 0, exp: {}, rk: {}, rk2: {}, t3: {} };
    c.n++;
    const t = r.exp in EXP ? r.exp : "none";
    c.exp[t] = (c.exp[t] ?? 0) + 1;
    c.rk[t] = (c.rk[t] ?? 0) + rank;
    c.rk2[t] = (c.rk2[t] ?? 0) + rank * rank;
    c.t3[t] = (c.t3[t] ?? 0) + (rank <= 3 ? 1 : 0);
    m.chars.set(key, c);
    // 최종 장비는 오래 살수록 완성돼 있어, 신규 방어구는 같은 부위에 같은 등급을 쓴 사람과 견줌
    const equip = r.equip ? JSON.parse(r.equip) : [];
    if (equip.length) {
      m.equipped++;
      if (m.equipLast !== r.game) m.equipGames++;
      m.equipLast = r.game;
    }
    for (const code of equip.slice(1)) {
      if (!code) continue;
      const g = `${Math.floor(code / 1000)}-${nm.item(code)[1]}`;
      for (const k of NEW_ARMOR.includes(code) ? [g, code] : [g]) {
        const a = m.armor.get(k) ?? acc();
        add(a, rank);
        m.armor.set(k, a);
      }
    }
    w.players++;
    const drops = JSON.parse(r.drops || "[]");
    if (drops.length) {
      w.drop++;
      w.buff = drops[0][0];
    }
    const cc = m.combos.get(key) ?? acc();
    add(cc, rank);
    m.combos.set(key, cc);
  }
  flush();
  const named = (key) => {
    const [char, weapon] = key.split("-").map(Number);
    const c = nm.char(char);
    return { char, weapon, key: c.key, name: c.name, weaponName: nm.weapon(weapon) };
  };
  if (!x.games) return null;
  const scored = scoreRows(tier, TIER_RULE);
  const b = baseline(baseRows);
  const wins = (map) => [...map.values()].reduce((s, a) => [s[0] + a.win, s[1] + a.n], [0, 0]);
  const [wn, nn] = wins(x.combos), [wt, nt] = wins(b.chars);
  const avgNow = nn ? wn / nn : 0, avgThen = nt ? wt / nt : 0;
  // 두 기간 모두 표본 thin 이상이고 승률 차이가 95% 범위를 넘는 조합만, 범위를 뺀 차이가 큰 순서로 고름
  const moved = [...x.combos]
    .filter(([key, a]) => a.n >= TIER_RULE.thin && (b.chars.get(key)?.n ?? 0) >= TIER_RULE.thin)
    .map(([key, a]) => {
      const p = b.chars.get(key);
      const now = a.win / a.n, then = p.win / p.n;
      const ci = 1.96 * Math.sqrt((now * (1 - now)) / a.n + (then * (1 - then)) / p.n) * 100;
      // 프리 시즌에는 7팀 경기와 봇 팀이 섞여 평균 승률이 달라서, 기간마다 평균과의 차이를 견줌
      const d = (now - avgNow - (then - avgThen)) * 100;
      return { ...named(key), n: a.n, win: pct(a.win, a.n), pick: +((a.n / x.teams) * 100).toFixed(2), d: fix1(d), dCi: fix1(ci), dPick: +((a.n / x.teams - p.n / b.teams.size) * 100).toFixed(2), edge: Math.abs(d) - ci };
    })
    .filter((c) => c.edge > 0)
    .sort((a, c) => c.edge - a.edge);
  const pick = (up) => moved.filter((c) => (c.d > 0) === up).slice(0, CHANGE_TOP).map(({ edge, ...c }) => c);
  return {
    updatedAt: Date.now(),
    season: { id: season.id, name: season.name },
    scan,
    games: x.games,
    players: x.players,
    bots: x.bots,
    // 7팀 경기가 섞여 있어 기준 승률은 팀 수로 구함
    base: pct(x.winTeams, x.teams),
    servers: [...x.servers].sort((a, b) => b[1] - a[1]).map(([name, games]) => ({ name, games })),
    modes: MODES.map((mode) => ({ mode, games: x.modes.get(mode) ?? 0 })),
    // 시즌 시작 시각이 아니라 실제로 받은 첫 경기부터 적음. 점검이 늦게 끝나면 둘이 다름
    from: x.from,
    to: x.to,
    exp: {
      teams: x.teams,
      rows: [...x.exp].map(([type, a]) => {
        const q = x.quest.get(type);
        return { type, name: EXP[type], ...out(a, x.teams), step1: q.n1 ? Math.round(q.t1 / q.n1) : null, step2: avg(q.c2, q.n2) };
      }),
      none: out(x.none, x.teams),
    },
    expChars: [...x.chars]
      .filter(([, c]) => c.n >= CHAR_MIN)
      .map(([key, c]) => {
        // 분야마다 CHAR_MIN명이 안 되면 성적은 비움
        const field = (f) => Object.fromEntries(Object.keys(EXP).map((k) => [k, (c.exp[k] ?? 0) >= CHAR_MIN ? f(k) : null]));
        // 분야의 평균 순위가 같은 실험체의 나머지 분야와 95% 범위를 넘게 다르면 1(좋음)이나 -1(나쁨)
        const all = Object.keys(EXP).reduce((s, k) => ({ n: s.n + (c.exp[k] ?? 0), rk: s.rk + (c.rk[k] ?? 0), rk2: s.rk2 + (c.rk2[k] ?? 0) }), { n: 0, rk: 0, rk2: 0 });
        const se2 = (n, rk, rk2) => Math.max(rk2 / n - (rk / n) ** 2, 0) / n;
        const edge = field((k) => {
          const rest = { n: all.n - c.exp[k], rk: all.rk - c.rk[k], rk2: all.rk2 - c.rk2[k] };
          if (rest.n < CHAR_MIN) return 0;
          const d = rest.rk / rest.n - c.rk[k] / c.exp[k];
          return Math.abs(d) > 1.96 * Math.sqrt(se2(c.exp[k], c.rk[k], c.rk2[k]) + se2(rest.n, rest.rk, rest.rk2)) ? Math.sign(d) : 0;
        });
        return {
          ...named(key),
          n: c.n,
          exp: Object.fromEntries(Object.keys(EXP).map((k) => [k, pct(c.exp[k] ?? 0, c.n)])),
          rank: field((k) => avg(c.rk[k], c.exp[k])),
          top3: field((k) => pct(c.t3[k], c.exp[k])),
          edge,
        };
      })
      .sort((a, b) => b.n - a.n),
    trios: [...x.trios]
      .filter(([, a]) => a.n >= TRIO_MIN)
      .map(([key, a]) => ({ key, members: key.split("+").map(named), n: a.n, win: pct(a.win, a.n), winCi: pctCi(a.win, a.n), top3: pct(a.t3, a.n), rank: avg(a.rank, a.n) }))
      .sort((a, b) => b.n - a.n),
    equipped: x.equipped,
    equipGames: x.equipGames,
    armor: NEW_ARMOR.filter((code) => x.armor.has(code)).map((code) => {
      const [name, grade] = nm.item(code);
      const a = x.armor.get(code);
      const g = x.armor.get(`${Math.floor(code / 1000)}-${grade}`);
      // 견줄 쪽은 같은 부위, 같은 등급에서 이 장비를 뺀 사람
      const rest = { n: g.n - a.n, rank: g.rank - a.rank, win: g.win - a.win };
      return { code, name, grade: GRADE_KO[grade] ?? grade, ...out(a, g.n), restWin: rest.n ? pct(rest.win, rest.n) : null, restRank: avg(rest.rank, rest.n) };
    }),
    weather: [...x.weathers]
      .filter(([code]) => code)
      .map(([code, v]) => ({
        code,
        name: nm.weather(code),
        games: v.games,
        share: pct(v.games, x.games),
        players: v.players,
        drop: v.buff ? nm.state(v.buff) : null,
        dropShare: pct(v.drop, v.players),
      }))
      .sort((a, b) => b.games - a.games),
    cobalt: cobalt(cb, named),
    change: b.players ? { games: b.games.size, from: b.from, to: b.to, avgNow: pct(wn, nn), avgThen: pct(wt, nt), up: pick(true), down: pick(false) } : null,
    tier: scored && {
      rows: scored.rows,
      thin: TIER_RULE.thin,
      combos: [...scored.combos].sort((a, c) => c.z - a.z).map((c, i, all) => ({
        ...named(`${c.char}-${c.weapon}`),
        grade: gradeAt(i, all.length),
        z: +c.z.toFixed(3),
        half: +c.half.toFixed(3),
        n: c.n,
        // 픽률은 등장 수 / 팀 수. 한 팀은 같은 실험체를 둘 고를 수 없어 모든 팀이 고르면 100%. 봇은 등장 수에서 빼고, 사람이 한 명이라도 있는 팀만 팀 수에 넣음
        pick: +((c.n / x.teams) * 100).toFixed(2),
        win: +(c.win * 100).toFixed(1),
        top3: +(c.top3 * 100).toFixed(1),
        place: +c.place.toFixed(2),
      })),
    },
  };
}

/** 코발트 조합은 전체 승률 쪽으로 당긴 승률로 줄을 세우고 같은 비율로 등급을 나눔 */
function cobalt(cb, named) {
  const list = [...cb.combos].filter(([, a]) => a.n >= CHAR_MIN);
  if (!list.length) return null;
  const base = list.reduce((s, [, a]) => s + a.win, 0) / list.reduce((s, [, a]) => s + a.n, 0);
  return {
    games: cb.games,
    teams: cb.teams,
    from: cb.from,
    to: cb.to,
    base: fix1(base * 100),
    combos: list
      .map(([key, a]) => ({ ...named(key), n: a.n, pick: +((a.n / cb.teams) * 100).toFixed(2), win: pct(a.win, a.n), winCi: pctCi(a.win, a.n), score: (a.win + COBALT_PRIOR * base) / (a.n + COBALT_PRIOR) }))
      .sort((a, c) => c.score - a.score)
      .map(({ score, ...c }, i, all) => ({ ...c, grade: gradeAt(i, all.length) })),
  };
}

/** root는 labs 자료 폴더. 화면이 쓰는 도중의 파일을 읽지 않게 임시 파일에 쓴 뒤 이름을 바꿈 */
export function writePre(root, data) {
  if (!data) return false;
  const dir = join(root, "er-preseason");
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.preseason.json.${process.pid}`);
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, join(dir, "preseason.json"));
  return true;
}

// 직접 실행하면 행을 읽기 전용으로 열어 집계만 다시 씀. 이름은 tier.json과 저장된 l10n에서 찾음
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { DatabaseSync } = await import("node:sqlite");
  const dir = process.env.TIER_DIR || "/Volumes/SSD/ertier/live";
  const outDir = process.env.TIER_OUT || join(homedir(), "docker/_data/labs/er-tier");
  const id = Number(process.argv[2]);
  if (!id) throw new Error("사용: node preseason.mjs <프리 시즌 ID> [이름] [시작 시각, 예: 2026-11-12T12:00+09:00] [직전 정규 시즌 ID]");
  const text = existsSync(join(dir, "l10n-ko.txt")) ? readFileSync(join(dir, "l10n-ko.txt"), "utf8") : "";
  const ko = (prefix) => new Map([...text.matchAll(new RegExp(`^${prefix}/([^┃\\r\\n]+)┃([^\\r\\n]*)`, "gm"))].map((x) => [x[1], x[2].trim()]));
  const [state, weather, item] = ["CharacterState/Group/Name", "Weather/Name", "Item/Name"].map(ko);
  const grades = existsSync(join(dir, "item-grades.json")) ? JSON.parse(readFileSync(join(dir, "item-grades.json"), "utf8")) : {};
  const tier = JSON.parse(readFileSync(join(outDir, "tier.json"), "utf8"));
  const chars = new Map(), weapons = new Map();
  for (const v of [...(tier.views ?? []), ...(tier.past?.views ?? [])]) for (const c of v.combos ?? []) {
    chars.set(c.char, { key: c.key, name: c.name });
    weapons.set(c.weapon, c.weaponName);
  }
  const nm = {
    char: (code) => chars.get(code) ?? { key: String(code), name: String(code) },
    weapon: (code) => weapons.get(code) ?? `무기 ${code}`,
    state: (code) => state.get(String(Math.floor(code / 100) * 100)) ?? `버프 ${code}`,
    weather: (code) => weather.get(String(code)) ?? `날씨 ${code}`,
    item: (code) => [item.get(String(code)) ?? `아이템 ${code}`, grades[code] ?? null],
  };
  const db = new DatabaseSync(join(dir, "preseason.sqlite"), { readOnly: true });
  const scan = db.prepare("SELECT ids, found FROM scan WHERE season = ?").get(id) ?? null;
  // 이 DB는 프리 시즌 13부터 쓰기 시작해 직전 시즌 행은 --pre-base로 모은 정규 시즌뿐임
  const prev = Number(process.argv[5]) || db.prepare("SELECT MAX(season) AS s FROM rows WHERE season < ?").get(id)?.s;
  const base = prev && baseReady(dir, prev) ? db.prepare("SELECT * FROM rows WHERE season = ? ORDER BY game, slot").iterate(prev) : [];
  const res = derivePre(db.prepare("SELECT * FROM rows WHERE season = ? ORDER BY game, slot").iterate(id), { id, name: process.argv[3] ?? `시즌 ${id}`, start: process.argv[4] ? Date.parse(process.argv[4]) : undefined }, nm, scan, base);
  console.log(writePre(join(outDir, ".."), res) ? `${res.games}경기, 티어 ${res.tier?.combos.length ?? 0}개 조합` : "해당 경기 없음");
}
