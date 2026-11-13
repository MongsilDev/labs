// 프리 시즌 특집 집계. 수집기가 preseason.sqlite에 모은 행만 읽고 공식 API에는 요청하지 않음
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { RULE, scoreRows } from "./score.mjs";

// 합쳐 싣는 모드는 랭크와 일반. 코발트 프로토콜과 이벤트 모드에는 실험 과제가 없음
export const MODES = [3, 2];
// RP와 플레이어 식별값을 저장하지 않아 정규 티어 계산에서 RP와 한 사람 몫 제한을 빼고 평균 순위와 TOP 3만 씀.
// mmr 자리에 경기의 팀 수를 넣어 7팀 경기와 8팀 경기의 순위 평균 차이를 구간 보정으로 뺌
export const TIER_RULE = { ...RULE, few: undefined, weights: { gain: 0, place: 0.5, top3: 0.5 }, bands: [8] };
// 실험체 줄은 이 판 수를 넘을 때만 보여 줌
export const CHAR_MIN = 30;
export const WEATHER_CHAR_MIN = 40;
const WEATHER_TOP = 5;
export const EXP = { Energy: "에너지 공학", Material: "재료 공학", Biotechnology: "생명 공학" };
// questStepClear의 experimentGroupId 앞자리. 실험 결과 분야와 맞춰 본 값이고 끝자리는 단계
const QUEST = { 1: "Material", 2: "Energy", 3: "Biotechnology" };

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
    games: 0, players: 0, bots: 0, teams: 0, winTeams: 0, from: Infinity, to: 0, servers: new Map(),
    exp: new Map(Object.keys(EXP).map((k) => [k, acc()])), none: acc(),
    chars: new Map(), gadgets: new Map(), noGadget: 0, weathers: new Map(),
    quest: new Map(Object.keys(EXP).map((k) => [k, { n1: 0, t1: 0, n2: 0, c2: 0 }])),
  };
}

/** rows는 preseason.sqlite rows 행을 game, slot 순서로. nm은 이름 찾기 함수 묶음, scan은 훑은 번호 수와 찾은 경기 수 */
export function derivePre(rows, season, nm, scan = null) {
  const x = fresh();
  const tier = [];
  let game = null, m = null, w = null, teams = null, list = [];
  const flush = () => {
    // 팀 수는 봇 팀까지 세야 경기 규모가 맞음
    const size = new Set(list.map((r) => r.team)).size;
    for (const r of list) if (!r.bot) tier.push({ game: r.game, player: `${r.game}-${r.slot}`, char: r.char, weapon: r.weapon, rank: r.rank, gain: 0, mmr: size });
    list = [];
  };
  for (const r of rows) {
    if (r.game !== game) {
      flush();
      game = r.game;
      m = MODES.includes(r.mode) ? x : null;
      if (!m) continue;
      m.games++;
      m.servers.set(r.server, (m.servers.get(r.server) ?? 0) + 1);
      m.from = Math.min(m.from, r.t);
      m.to = Math.max(m.to, r.t);
      w = m.weathers.get(r.weather) ?? { games: 0, players: 0, drop: 0, buff: null, chars: new Map() };
      w.games++;
      m.weathers.set(r.weather, w);
      teams = new Set();
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
    const c = m.chars.get(key) ?? { n: 0, exp: {} };
    c.n++;
    const t = r.exp in EXP ? r.exp : "none";
    c.exp[t] = (c.exp[t] ?? 0) + 1;
    m.chars.set(key, c);
    // 예전 행은 쓴 가젯 코드 배열만 있고, 지금 행은 코드별 사용 횟수
    const raw = JSON.parse(r.gadgets || "[]");
    const used = Array.isArray(raw) ? raw.map((code) => [code, null]) : Object.entries(raw).map(([code, k]) => [Number(code), k]);
    if (!used.length) m.noGadget++;
    for (const [code, k] of used) {
      const x = m.gadgets.get(code) ?? { n: 0, known: 0, uses: 0, multi: 0 };
      x.n++;
      if (k != null) {
        x.known++;
        x.uses += k;
        if (k > 1) x.multi++;
      }
      m.gadgets.set(code, x);
    }
    w.players++;
    const drops = JSON.parse(r.drops || "[]");
    if (drops.length) {
      w.drop++;
      w.buff = drops[0][0];
    }
    const wc = w.chars.get(key) ?? acc();
    add(wc, rank);
    w.chars.set(key, wc);
  }
  flush();
  const named = (key) => {
    const [char, weapon] = key.split("-").map(Number);
    const c = nm.char(char);
    return { char, weapon, key: c.key, name: c.name, weaponName: nm.weapon(weapon) };
  };
  if (!x.games) return null;
  const scored = scoreRows(tier, TIER_RULE);
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
    // 시즌 시작부터 모은 기록이라 기간은 첫 경기 대신 시즌 시작부터 적음
    from: Math.min(season.start ?? x.from, x.from),
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
      .map(([key, c]) => ({ ...named(key), n: c.n, exp: Object.fromEntries(Object.keys(EXP).map((k) => [k, pct(c.exp[k] ?? 0, c.n)])) }))
      .sort((a, b) => b.n - a.n),
    // 오래 살아남을수록 쓸 기회가 많아 승률과 순위는 싣지 않고 쓰임새만 셈
    gadgets: [...x.gadgets]
      .map(([code, a]) => ({ code, name: nm.skill(code), n: a.n, share: pct(a.n, x.players), per: avg(a.uses, a.known), multi: a.known ? pct(a.multi, a.known) : null }))
      .sort((a, b) => b.n - a.n),
    noGadget: { n: x.noGadget, share: pct(x.noGadget, x.players) },
    weather: [...x.weathers]
      .filter(([code]) => code)
      .map(([code, v]) => ({
        code,
        name: nm.weather(code),
        games: v.games,
        players: v.players,
        drop: v.buff ? nm.state(v.buff) : null,
        dropShare: pct(v.drop, v.players),
        top: [...v.chars]
          .filter(([, a]) => a.n >= WEATHER_CHAR_MIN)
          .map(([key, a]) => ({ ...named(key), ...out(a, v.players) }))
          .sort((a, b) => b.win - a.win || b.n - a.n)
          .slice(0, WEATHER_TOP),
      }))
      .sort((a, b) => b.games - a.games),
    tier: scored && {
      rows: scored.rows,
      thin: TIER_RULE.thin,
      combos: scored.combos.map((c) => ({
        ...named(`${c.char}-${c.weapon}`),
        grade: c.grade,
        z: +c.z.toFixed(3),
        half: +c.half.toFixed(3),
        n: c.n,
        pick: +(c.pick * 100).toFixed(2),
        win: +(c.win * 100).toFixed(1),
        top3: +(c.top3 * 100).toFixed(1),
        place: +c.place.toFixed(2),
      })),
    },
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
  if (!id) throw new Error("사용: node preseason.mjs <프리 시즌 ID> [이름] [시작 시각, 예: 2026-11-12T12:00+09:00]");
  const text = existsSync(join(dir, "l10n-ko.txt")) ? readFileSync(join(dir, "l10n-ko.txt"), "utf8") : "";
  const ko = (prefix) => new Map([...text.matchAll(new RegExp(`^${prefix}/([^┃\\r\\n]+)┃([^\\r\\n]*)`, "gm"))].map((x) => [x[1], x[2].trim()]));
  const [skill, state, weather] = ["Skill/Group/Name", "CharacterState/Group/Name", "Weather/Name"].map(ko);
  const tier = JSON.parse(readFileSync(join(outDir, "tier.json"), "utf8"));
  const chars = new Map(), weapons = new Map();
  for (const v of [...(tier.views ?? []), ...(tier.past?.views ?? [])]) for (const c of v.combos ?? []) {
    chars.set(c.char, { key: c.key, name: c.name });
    weapons.set(c.weapon, c.weaponName);
  }
  const nm = {
    char: (code) => chars.get(code) ?? { key: String(code), name: String(code) },
    weapon: (code) => weapons.get(code) ?? `무기 ${code}`,
    skill: (code) => skill.get(String(Math.floor(code / 100) * 100)) ?? `가젯 ${code}`,
    state: (code) => state.get(String(Math.floor(code / 100) * 100)) ?? `버프 ${code}`,
    weather: (code) => weather.get(String(code)) ?? `날씨 ${code}`,
  };
  const db = new DatabaseSync(join(dir, "preseason.sqlite"), { readOnly: true });
  const scan = db.prepare("SELECT ids, found FROM scan WHERE season = ?").get(id) ?? null;
  const res = derivePre(db.prepare("SELECT * FROM rows WHERE season = ? ORDER BY game, slot").iterate(id), { id, name: process.argv[3] ?? `시즌 ${id}`, start: process.argv[4] ? Date.parse(process.argv[4]) : undefined }, nm, scan);
  console.log(writePre(join(outDir, ".."), res) ? `${res.games}경기, 티어 ${res.tier.combos.length}개 조합` : "해당 경기 없음");
}
