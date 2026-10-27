import "server-only";
import { byCharacter, byText } from "@/er/lib/format";
import { EVENT_NAME, KEL_EVENTS, TEAM, type KelEvent } from "@/er/lib/kel";
import { finalState, placementPoints, type FinalState, type Round } from "@/er/lib/kel-calc";
import { CIRCUIT_STAGES, stageRounds, type Kel, type KelRow, type TeamGame } from "./kel";
import type { KelDak } from "./kel-dakgg";

type DakRow = KelRow & { dak: KelDak };
const withDak = (rows: KelRow[]) => rows.filter((r): r is DakRow => Boolean(r.dak));

// 선수끼리 견주는 순위는 30게임 이상 나온 선수만
export const MIN_GAMES = 30;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const count = (rows: { gameId: number }[]) => new Set(rows.map((r) => r.gameId)).size;

// kelData가 같은 객체를 돌려주는 동안 계산 결과를 다시 씀
function memo<T>(f: (data: Kel) => T): (data: Kel) => T {
  const cache = new WeakMap<Kel, T>();
  return (data) => {
    if (!cache.has(data)) cache.set(data, f(data));
    return cache.get(data)!;
  };
}

// 팀 세 명 모두 경기 상세가 붙은 팀 게임, 일부만 붙으면 팀 합계와 비중이 틀어짐
const fullTeams = memo((data) => new Set([...Map.groupBy(data.rows, (r) => `${r.gameId}:${r.team}`)].filter(([, list]) => list.every((r) => r.dak)).map(([key]) => key)));

export function top<T>(list: T[], value: (x: T) => number, tie: (x: T) => number = () => 0): T {
  return list.reduce((a, x) => (value(x) > value(a) || (value(x) === value(a) && tie(x) > tie(a)) ? x : a));
}


// 줄바꿈은 대회 이름과 단계 사이에서만
const keep = (s: string) => s.replaceAll(" ", "\u00a0");
export const gameLabel = (g: { event: KelEvent; stage: string; round: number }) => `${keep(EVENT_NAME[g.event])} ${keep(`${g.stage} ${g.round}R`)}`;

// finals는 모든 대회의 결승 단계를 합친 범위
export type StyleScope = "season" | "finals" | KelEvent;

export type TeamStyle = { team: string; games: number; wins: number; eighth: number; top3: number; rankPerGame: number; killPerGame: number; killShare: number; perGame: number };

export const inScope = (scope: StyleScope) => (g: { event: KelEvent; stage: string }) => (scope === "season" ? true : scope === "finals" ? g.stage === "결승" : g.event === scope);

export function teamStyles(data: Kel, scope: StyleScope): TeamStyle[] {
  const games = data.games.filter(inScope(scope));
  return [...Map.groupBy(games, (g) => g.team)]
    .map(([team, list]) => {
      const rank = list.reduce((a, g) => a + placementPoints(g.placement), 0);
      const kill = list.reduce((a, g) => a + g.killScore, 0);
      return {
        team,
        games: list.length,
        wins: list.filter((g) => g.placement === 1).length,
        eighth: list.filter((g) => g.placement === 8).length,
        top3: list.filter((g) => g.placement <= 3).length / list.length,
        rankPerGame: rank / list.length,
        killPerGame: kill / list.length,
        killShare: rank + kill > 0 ? kill / (rank + kill) : 0,
        perGame: (rank + kill) / list.length,
      };
    })
    .sort((a, b) => b.perGame - a.perGame);
}

export type PlayerStat = {
  name: string;
  team: string;
  games: number;
  wins: number;
  kpr: number;
  kills: number;
  deaths: number;
  top3: number;
  avgPlace: number;
  damage: number;
  damageShare: number;
  takenShare: number;
  cc: number;
  heal: number;
  vision: number;
  camera: number;
  cameraOff: number;
  revive: number;
  time: number;
  ccShare: number;
  healShare: number;
  dakGames: number;
  characters: [string, number][];
  // cc와 heal은 경기 상세가 없거나 값이 모두 0이면 null
  bests: { kills: KelRow; damage: KelRow; cc: DakRow | null; heal: DakRow | null };
};

// 경기 상세 값은 상세가 있는 게임만 평균하고, 팀 합계가 0인 게임은 비중 0으로 셈
export const playerStats = memo((data): PlayerStat[] => {
  const teamGame = new Map(data.games.map((g) => [`${g.gameId}:${g.team}`, g]));
  const full = fullTeams(data);
  return [...Map.groupBy(data.rows, (r) => r.player)].map(([name, rows]) => {
    const dak = withDak(rows);
    const avg = (value: (d: KelDak) => number) => mean(dak.map((r) => value(r.dak)));
    const shares = rows.map((r) => {
      const key = `${r.gameId}:${r.team}`;
      const g = teamGame.get(key);
      const d = full.has(key) ? r.dak : undefined;
      return {
        damage: g?.damage ? r.damage / g.damage : 0,
        taken: g?.taken ? r.taken / g.taken : 0,
        cc: d ? (g?.cc ? d.cc / g.cc : 0) : [],
        heal: d ? (g?.heal ? d.heal / g.heal : 0) : [],
      };
    });
    return {
      name,
      team: rows[0].team,
      games: rows.length,
      wins: rows.filter((r) => r.placement === 1).length,
      kpr: mean(rows.map((r) => r.kpr)),
      kills: mean(rows.map((r) => r.kills)),
      deaths: mean(rows.map((r) => r.deaths)),
      top3: rows.filter((r) => r.placement <= 3).length / rows.length,
      avgPlace: mean(rows.map((r) => r.placement)),
      damage: mean(rows.map((r) => r.damage)),
      damageShare: mean(shares.map((x) => x.damage)),
      takenShare: mean(shares.map((x) => x.taken)),
      cc: avg((d) => d.cc),
      heal: avg((d) => d.heal),
      vision: avg((d) => d.vision),
      camera: avg((d) => d.camera),
      cameraOff: avg((d) => d.cameraOff),
      revive: avg((d) => d.revive),
      time: avg((d) => d.time),
      ccShare: mean(shares.flatMap((x) => x.cc)),
      healShare: mean(shares.flatMap((x) => x.heal)),
      dakGames: dak.length,
      characters: [...Map.groupBy(rows, (r) => r.character)].map(([k, v]): [string, number] => [k, v.length]).sort((a, b) => b[1] - a[1] || byCharacter(a[0], b[0])),
      bests: {
        kills: top(
          rows,
          (r) => r.kills,
          (r) => r.damage,
        ),
        damage: top(rows, (r) => r.damage),
        cc: dak.some((r) => r.dak.cc > 0) ? top(dak, (r) => r.dak.cc) : null,
        heal: dak.some((r) => r.dak.heal > 0) ? top(dak, (r) => r.dak.heal) : null,
      },
    };
  });
});

export type Metric = "kpr" | "kills" | "deaths" | "top3" | "avgPlace" | "damage" | "damageShare" | "cc" | "heal" | "vision" | "camera" | "revive" | "time";

// 평균 순위와 데스는 작을수록 위
const LOWER = new Set<Metric>(["avgPlace", "deaths"]);
// 경기 상세가 하나도 없는 선수는 이 지표의 순위에서 뺌
export const DAK_METRICS = new Set<Metric>(["cc", "heal", "vision", "camera", "revive", "time"]);

const comparable = (x: PlayerStat, metric: Metric) => x.games >= MIN_GAMES && (!DAK_METRICS.has(metric) || x.dakGames > 0);

export function rankOf(players: PlayerStat[], p: PlayerStat, metric: Metric): number | null {
  if (!comparable(p, metric)) return null;
  const sign = LOWER.has(metric) ? -1 : 1;
  return 1 + players.filter((x) => comparable(x, metric) && sign * x[metric] > sign * p[metric]).length;
}

// rankOf가 견주는 선수 수
export const rankPool = (players: PlayerStat[], metric: Metric) => players.filter((x) => comparable(x, metric)).length;

export type CharacterStat = { key: string; games: number; rate: number; byEvent: Record<KelEvent, number>; avgPlace: number; winRate: number };

export function characterStats(data: Kel): { total: number; eventGames: Record<KelEvent, number>; rows: CharacterStat[] } {
  const byEvent = Map.groupBy(data.rows, (r) => r.event);
  const eventGames = Object.fromEntries(KEL_EVENTS.map((e) => [e.key, count(byEvent.get(e.key) ?? [])])) as Record<KelEvent, number>;
  const total = count(data.rows);
  const rows = [...Map.groupBy(data.rows, (r) => r.character)].map(([key, list]) => {
    const ev = Map.groupBy(list, (r) => r.event);
    const games = count(list);
    return {
      key,
      games,
      rate: games / total,
      byEvent: Object.fromEntries(KEL_EVENTS.map((e) => [e.key, eventGames[e.key] ? count(ev.get(e.key) ?? []) / eventGames[e.key] : 0])) as Record<KelEvent, number>,
      avgPlace: mean(list.map((r) => r.placement)),
      winRate: list.filter((r) => r.placement === 1).length / list.length,
    };
  });
  return { total, eventGames, rows };
}

export type Comp = { characters: string[]; count: number; avgPlace: number; wins: number; teams: [string, number][] };

export function comps(data: Kel, min: number): Comp[] {
  const full = data.games.filter((g) => g.characters.length === 3);
  return [...Map.groupBy(full, (g) => [...g.characters].sort().join("|"))]
    .filter(([, list]) => list.length >= min)
    .map(([key, list]) => ({
      characters: key.split("|").sort(byCharacter),
      count: list.length,
      avgPlace: mean(list.map((g) => g.placement)),
      wins: list.filter((g) => g.placement === 1).length,
      teams: [...Map.groupBy(list, (g) => g.team)]
        .map(([t, v]): [string, number] => [t, v.length])
        .sort((a, b) => b[1] - a[1] || byText(TEAM.get(a[0])!.name, TEAM.get(b[0])!.name)),
    }))
    .sort((a, b) => b.count - a.count || a.avgPlace - b.avgPlace);
}

const STAGE_ORDER: readonly string[] = CIRCUIT_STAGES;
// 같은 값의 기록이 경기 순서대로 나오도록 날짜, 단계, 라운드 순으로 미리 정렬
const inOrder = <T extends { date: string; stage: string; round: number }>(rows: T[]) =>
  [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.round - b.round));

// 감점 전 게임 점수, 결승 라운드별 점수 표의 라운드 칸과 같은 값
const teamGameScore = (g: TeamGame) => placementPoints(g.placement) + g.killScore;

export const records = memo((data) => {
  const rows = inOrder(data.rows);
  const teamScore = ranked(inOrder(data.games), teamGameScore, 1).map(({ r }) => r);
  const low = rows.filter((r) => r.placement >= 7);
  const dak = withDak(rows);
  const best = (value: (d: KelDak) => number) => (dak.length ? top(dak, (r) => value(r.dak)) : null);
  return {
    cc: best((d) => d.cc),
    heal: best((d) => d.heal),
    camera: best((d) => d.camera),
    vision: best((d) => d.vision),
    kills: top(
      rows,
      (r) => r.kills,
      (r) => r.damage,
    ),
    damage: ranked(rows, (r) => r.damage),
    taken: top(rows, (r) => r.taken),
    lowTeamDamage: low.length ? top(low, (r) => r.damage) : null,
    teamKills: top(data.games, (g) => g.kills),
    // 동점은 모두 넣음
    teamScore: { value: teamScore.length ? teamGameScore(teamScore[0]) : 0, games: teamScore },
    characters: [...Map.groupBy(rows, (r) => r.character)]
      .map(([key, list]) => ({
        key,
        kills: top(
          list,
          (r) => r.kills,
          (r) => r.damage,
        ),
        damage: top(list, (r) => r.damage),
      }))
      .sort((a, b) => byCharacter(a.key, b.key)),
  };
});

export type Records = ReturnType<typeof records>;

// n위 안의 기록을 같은 값은 같은 순위로 모두 넣음
export function ranked<T>(list: T[], value: (x: T) => number, n = 5): { r: T; rank: number }[] {
  const sorted = [...list].sort((a, b) => value(b) - value(a));
  const out: { r: T; rank: number }[] = [];
  for (const r of sorted) {
    const prev = out.at(-1);
    const rank = prev && value(prev.r) === value(r) ? prev.rank : out.length + 1;
    if (rank > n) break;
    out.push({ r, rank });
  }
  return out;
}

export const lows = memo((data) => {
  const rows = inOrder(data.rows);
  return { damage: ranked(rows, (r) => -r.damage), deaths: ranked(rows, (r) => r.deaths) };
});

export type KillPair = { killer: KelRow; victim: KelRow; count: number };

// 킬 기록에는 잡힌 실험체만 남음. 같은 실험체를 고른 상대가 둘 이상이면 그 상대들의 데스 기록으로 가리고, 상대를 한 명으로 정하지 못한 킬은 셈에서 뺌
export const killStats = memo((data) => {
  let total = 0;
  const pairs = new Map<string, KillPair>();
  const teams = new Map<string, number>();
  for (const rows of Map.groupBy(withDak(data.rows), (r) => r.gameId).values()) {
    for (const k of rows) {
      for (const [num, count] of Object.entries(k.dak.killed)) {
        total += count;
        let v = rows.filter((r) => r.team !== k.team && String(r.dak.num) === num);
        if (v.length > 1) v = v.filter((r) => String(k.dak.num) in r.dak.killedBy);
        if (v.length !== 1) continue;
        const key = `${k.player}|${v[0].player}`;
        const pair = pairs.get(key) ?? { killer: k, victim: v[0], count: 0 };
        pair.count += count;
        pairs.set(key, pair);
        const t = `${k.team}|${v[0].team}`;
        teams.set(t, (teams.get(t) ?? 0) + count);
      }
    }
  }
  // 킬과 같은 범위로 세도록 경기 상세가 있는 게임만
  const dakGames = new Set(withDak(data.rows).map((r) => r.gameId));
  const together = new Map<string, number>();
  for (const list of Map.groupBy(
    data.games.filter((g) => dakGames.has(g.gameId)),
    (g) => g.gameId,
  ).values()) {
    for (const a of list) for (const b of list) if (a !== b) together.set(`${a.team}|${b.team}`, (together.get(`${a.team}|${b.team}`) ?? 0) + 1);
  }
  const list = [...pairs.values()];
  return { total, counted: list.reduce((a, p) => a + p.count, 0), pairs: list, teams, together };
});

// 팀 선수 가운데 누구라도 위클라인을 처치한 게임 수, 경기 상세가 없는 게임은 세지 않음
export function wicklines(data: Kel): { team: string; count: number; games: number }[] {
  const games = data.games.filter((g) => g.wickline !== undefined);
  if (!games.some((g) => g.wickline)) return [];
  return [...Map.groupBy(games, (g) => g.team)]
    .map(([team, list]) => ({ team, games: list.length, count: list.filter((g) => g.wickline).length }))
    .sort((a, b) => b.count - a.count || a.games - b.games);
}

// 오프닝 위크는 결승이 없어 빠짐, 탭은 시간 순서
const FINAL_ORDER = KEL_EVENTS.map((e) => e.key);

// weather는 라운드별 메인 날씨, 경기 상세가 없는 라운드는 빈 문자열
export type Final = { event: KelEvent; teams: string[]; rounds: Round[]; state: FinalState; weather: string[] };

export function finals(data: Kel): Final[] {
  const weather = new Map(withDak(data.rows).map((r) => [r.gameId, r.dak.weather]));
  return FINAL_ORDER.flatMap((event) => {
    const { teams, rounds: all } = stageRounds(data, event, "결승");
    if (!teams.length) return [];
    const end = all.findIndex((r) => !r);
    const rounds = end < 0 ? all : all.slice(0, end);
    const ids = new Map(data.games.filter((g) => g.event === event && g.stage === "결승").map((g) => [g.round, g.gameId]));
    return [{ event, teams, rounds, state: finalState(teams, rounds), weather: rounds.map((_, i) => weather.get(ids.get(i + 1) ?? 0) ?? "") }];
  });
}

export type TeamOps = {
  team: string;
  games: number;
  wickline: number;
  wicklinePlace: number | null;
  time: number;
  vision: number;
  camera: number;
  escaped: number;
  start: [string, number] | null;
};

// 지역별 비율이 큰 순서로 n곳, 같은 비율은 이름순
function favorites(rows: DakRow[], n: number): [string, number][] {
  return [...Map.groupBy(rows, (r) => r.dak.start)]
    .map(([area, list]): [string, number] => [area, list.length / rows.length])
    .sort((a, b) => b[1] - a[1] || byText(a[0], b[0]))
    .slice(0, n);
}

// 팀 성향 운영 보기, 세 명 모두 경기 상세가 있는 팀 게임만 셈. ranks는 위클라인을 잡은 팀의 순위별 게임 수
export function teamOps(data: Kel, scope: StyleScope): { rows: TeamOps[]; ranks: number[] } {
  const full = fullTeams(data);
  const rows = withDak(data.rows)
    .filter(inScope(scope))
    .filter((r) => full.has(`${r.gameId}:${r.team}`));
  const ranks = Array.from({ length: 8 }, () => 0);
  const out = [...Map.groupBy(rows, (r) => r.team)].map(([team, list]): TeamOps => {
    const games = [...Map.groupBy(list, (r) => r.gameId).values()];
    const wick = games.filter((g) => g.some((r) => r.dak.wickline));
    for (const g of wick) ranks[g[0].placement - 1]++;
    const sum = (g: DakRow[], value: (d: KelDak) => number) => g.reduce((a, r) => a + value(r.dak), 0);
    return {
      team,
      games: games.length,
      wickline: wick.length,
      wicklinePlace: wick.length ? mean(wick.map((g) => g[0].placement)) : null,
      time: mean(games.map((g) => Math.max(...g.map((r) => r.dak.time)))),
      vision: mean(games.map((g) => sum(g, (d) => d.vision))),
      camera: mean(games.map((g) => sum(g, (d) => d.camera))),
      escaped: games.filter((g) => g.every((r) => r.dak.escaped)).length,
      start: favorites(
        list.filter((r) => r.dak.start),
        1,
      )[0] ?? null,
    };
  });
  return { rows: out, ranks };
}

// 시작 지역 표는 이보다 많이 시작한 지역만 넣음
export const MIN_STARTS = 40;

// 시작 지역은 선수 한 명이 한 게임에서 시작한 기록 하나로 셈
export function regions(data: Kel) {
  const rows = withDak(data.rows);
  const started = rows.filter((r) => r.dak.start);
  const starts = [...Map.groupBy(started, (r) => r.dak.start)]
    .map(([area, list]) => ({ area, count: list.length, avgPlace: mean(list.map((r) => r.placement)), top3: list.filter((r) => r.placement <= 3).length / list.length }))
    .sort((a, b) => a.avgPlace - b.avgPlace || b.count - a.count);
  const deaths = new Map<string, number>();
  for (const r of rows) for (const area of r.dak.deathPlaces) deaths.set(area, (deaths.get(area) ?? 0) + 1);
  return {
    starts,
    deaths: [...deaths]
      .map(([area, count]) => ({ area, count, starts: starts.find((s) => s.area === area)?.count ?? 0 }))
      .sort((a, b) => b.count - a.count || byText(a.area, b.area)),
    teams: [...Map.groupBy(started, (r) => r.team)].map(([team, list]) => ({ team, areas: favorites(list, 3) })),
    players: [...Map.groupBy(started, (r) => r.player)]
      .filter(([, list]) => list.length >= MIN_GAMES)
      .map(([name, list]) => ({ name, team: list[0].team, games: list.length, areas: favorites(list, 3) })),
  };
}

// 비율은 [이름, 횟수, 분모 대비 비율]로, 많은 순서대로
export type Share = { name: string; count: number; share: number };

function shares<T>(list: T[], name: (x: T) => string, total = list.length): Share[] {
  return [...Map.groupBy(list.filter((x) => name(x)), name)]
    .map(([k, v]) => ({ name: k, count: v.length, share: total ? v.length / total : 0 }))
    .sort((a, b) => b.count - a.count || byText(a.name, b.name));
}

export type GearSlot = { slot: string; weapon?: string } & Share;

export type CharacterBuild = {
  key: string;
  picks: number;
  // 고른 기록 가운데 경기 상세가 있는 수, 빌드 비율의 분모
  records: number;
  games: number;
  rate: number;
  avgPlace: number;
  wins: number;
  winRate: number;
  weapons: (Share & { avgPlace: number })[];
  tactical: Share[];
  traits: Share[];
  // 사망 기록 첫 칸에서 이 실험체가 처치한 수와, 목록에 든 기술 가운데 원문 이름으로 적은 처치 수
  deaths: number;
  unnamed: number;
  lastHits: Share[];
  gear: GearSlot[];
  order: Share | null;
  skills: KelDak["skills"];
  players: { name: string; team: string; count: number }[];
};

const GEAR = ["무기", "옷", "머리", "팔", "다리"];

// 무기 칸은 무기 종류마다 따로 셈. 분모는 그 무기를 든 기록 수
// 무기가 하나뿐이면 이름표를 '무기'로 둠. 하트 '기타'는 옷, 머리 옆에서 '그 외'로 읽힘
function gearOf(rows: DakRow[], weapons: Share[]): GearSlot[] {
  const weapon = weapons.flatMap((w) => {
    const list = rows.filter((r) => r.dak.weapon === w.name);
    const top = shares(list, (r) => r.dak.gear[0])[0];
    return top ? [{ slot: weapons.length > 1 ? w.name : GEAR[0], weapon: w.name, ...top }] : [];
  });
  const rest = GEAR.slice(1).flatMap((slot, i) => {
    const top = shares(rows, (r) => r.dak.gear[i + 1])[0];
    return top ? [{ slot, ...top }] : [];
  });
  return [...weapon, ...rest];
}

// 실험체 카드. 무기, 전술 스킬, 특성, 장비, 스킬 순서의 분모는 그 실험체를 고른 기록 수
export const characterBuilds = memo((data) => {
  const all = withDak(data.rows);
  if (!all.some((r) => r.dak.tactical || r.dak.weapon)) return [];
  const total = count(data.rows);
  // dak.gg 처치 실험체 key를 경기 기록 이름으로, attachDak처럼 소문자로 맞춤
  const keyOf = new Map(data.rows.map((r) => [r.character.toLowerCase(), r.character]));
  const hits = Map.groupBy(
    all.flatMap((r) => (r.dak.death ? [{ ...r.dak.death, character: keyOf.get(r.dak.death.character.toLowerCase()) ?? r.dak.death.character }] : [])),
    (d) => d.character,
  );
  // 고른 횟수와 순위는 경기 상세가 없는 기록까지 셈
  const picked = Map.groupBy(data.rows, (r) => r.character);
  return [...Map.groupBy(all, (r) => r.character)]
    .map(([key, rows]): CharacterBuild => {
      const weapons = shares(rows, (r) => r.dak.weapon).map((w) => ({ ...w, avgPlace: mean(rows.filter((r) => r.dak.weapon === w.name).map((r) => r.placement)) }));
      const killed = hits.get(key) ?? [];
      const lastHits = shares(killed, (d) => d.cause).slice(0, 4);
      const raw = new Set(killed.filter((d) => !d.official).map((d) => d.cause));
      const every = picked.get(key) ?? rows;
      const wins = every.filter((r) => r.placement === 1).length;
      return {
        key,
        picks: every.length,
        records: rows.length,
        games: count(every),
        rate: count(every) / total,
        avgPlace: mean(every.map((r) => r.placement)),
        wins,
        winRate: wins / every.length,
        weapons,
        tactical: shares(rows, (r) => r.dak.tactical).slice(0, 3),
        traits: shares(rows, (r) => r.dak.trait).slice(0, 3),
        deaths: killed.length,
        unnamed: lastHits.filter((h) => raw.has(h.name)).reduce((a, h) => a + h.count, 0),
        lastHits,
        gear: gearOf(rows, weapons),
        order: shares(rows, (r) => r.dak.order)[0] ?? null,
        skills: rows[0].dak.skills,
        players: [...Map.groupBy(every, (r) => r.player)]
          .map(([name, v]) => ({ name, team: v[0].team, count: v.length }))
          .sort((a, b) => b.count - a.count || byText(a.name, b.name))
          .slice(0, 4),
      };
    })
    .sort((a, b) => b.picks - a.picks || byCharacter(a.key, b.key));
});

export type PickRate = Share & { avgPlace: number; group?: string; byEvent: Record<KelEvent, number | null> };

// 분모는 그 대회의 선수 기록 수
function pickRates(rows: DakRow[], name: (r: DakRow) => string): PickRate[] {
  const byEvent = Map.groupBy(rows, (r) => r.event);
  return shares(rows, name).map((s) => {
    const list = rows.filter((r) => name(r) === s.name);
    return {
      ...s,
      avgPlace: mean(list.map((r) => r.placement)),
      byEvent: Object.fromEntries(
        KEL_EVENTS.map((e) => {
          const ev = byEvent.get(e.key) ?? [];
          return [e.key, ev.length ? ev.filter((r) => name(r) === s.name).length / ev.length : null];
        }),
      ) as Record<KelEvent, number | null>,
    };
  });
}

export const seasonBuilds = memo((data) => {
  const rows = withDak(data.rows);
  const groups = new Map(rows.map((r) => [r.dak.trait, r.dak.traitGroup]));
  return {
    records: rows.length,
    tactical: pickRates(rows, (r) => r.dak.tactical),
    traits: pickRates(rows, (r) => r.dak.trait).map((t) => ({ ...t, group: groups.get(t.name) })),
  };
});

// 첫 화면 KEL 카드. 많이 나온 실험체, 한 게임 최고 기록, 자주 나온 3인 조합을 n개씩
export const highlights = memo((data) => {
  const rec = records(data);
  const bests = [
    { key: "kills", label: "킬", r: rec.kills, value: rec.kills.kills },
    { key: "damage", label: "가한 피해", r: rec.damage[0]?.r, value: rec.damage[0]?.r.damage },
    { key: "taken", label: "받은 피해", r: rec.taken, value: rec.taken.taken },
  ].filter((b): b is { key: string; label: string; r: KelRow; value: number } => Boolean(b.r));
  return {
    characters: [...characterStats(data).rows].sort((a, b) => b.games - a.games || byCharacter(a.key, b.key)).slice(0, 3),
    bests,
    comps: comps(data, 1).slice(0, 3),
  };
});

export const kelHighlights = (data: Kel | null) => (data && data.rows.length ? highlights(data) : null);

// 서울 날짜 기준으로 date(YYYY-MM-DD)까지 남은 날 수, 지난 날은 음수
export function daysUntil(date: string, now = new Date()): number {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
  return Math.round((Date.parse(date) - Date.parse(today)) / 864e5);
}
