import type { Player } from "./parse";
import type { TournamentView } from "./view";
import { CHECKPOINT_SEQUENCE, MAIN_WEATHERS, SUB_WEATHERS, defaultMainWeather, type Ban, type Mode, type Rules } from "./rules";

export type RoundInput = {
  roundNo: number;
  source: "csv" | "manual";
  gameId: number | null;
  players: Player[];
};

export type PenaltyInput = {
  id: number;
  team: string;
  roundNo: number;
  kind: "death" | "rule";
  count: number;
  points: number;
  reason: string;
};

export type WeatherInput = { roundNo: number; main: string | null; sub: string | null };

export type GroupInput = {
  mode: Mode;
  rules: Rules;
  plannedRounds: number;
  rounds: RoundInput[];
  penalties: PenaltyInput[];
  weather: WeatherInput[];
  aliases: Record<string, string>;
  overrides: Record<string, boolean>;
};

export type TeamRound = {
  placement: number | null;
  killScore: number;
  kills: number;
  rankScore: number;
  score: number;
};

export const barTotal = (s: { rounds: (TeamRound | null)[] }) => s.rounds.reduce((a, r) => a + Math.max(0, r?.score ?? 0), 0);

export type Standing = {
  key: string;
  base: string;
  bases: { round: number; base: string }[];
  name: string;
  rank: number;
  delta: number;
  rounds: (TeamRound | null)[];
  roundScore: number;
  killScore: number;
  kills: number;
  rankScore: number;
  wins: number;
  penalty: number;
  total: number;
  lastPlacement: number | null;
  checkpoint: boolean;
  fixed: number | null;
  tiedBy: "killScore" | "kills" | "rankScore" | "wins" | "lastPlacement" | null;
};

export type RoundSummary = {
  roundNo: number;
  gameId: number | null;
  source: "csv" | "manual";
  teamCount: number;
  winner: string | null;
  main: string;
  sub: string | null;
};

export type NextRound = {
  roundNo: number;
  main: string;
  sub: string | null;
  subRemaining: string[];
  bans: string[];
  checkpoint: string[];
  weatherPick: string | null;
};

export type PlayerStat = { nickname: string; team: string; rounds: number; kills: number; value: number; rank: number };

export type GroupResult = {
  standings: Standing[];
  displayOf: Map<string, string>;
  orphanPenalties: number[];
  rounds: RoundSummary[];
  played: number;
  next: NextRound | null;
  ended: boolean;
  picks: { roundNo: number; counts: { character: string; count: number; banRounds: number }[] }[];
  players: PlayerStat[];
};

const DEFAULT_TEAM = /^team\s*\d+$/i;
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export function normalize(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

type Agg = TeamRound & { name: string; key: string; nicknames: Set<string>; csvTotal: number };
type Raw = Omit<Agg, "key" | "score" | "rankScore"> & { round: number; source: RoundInput["source"]; base: string };

function collect(round: RoundInput): Map<string, Raw> {
  const byName = new Map<string, Raw>();
  for (const p of round.players) {
    const name = p.team.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const id = normalize(name);
    const a: Raw = byName.get(id) ?? {
      round: round.roundNo,
      source: round.source,
      name,
      base: name,
      placement: null,
      killScore: 0,
      kills: 0,
      nicknames: new Set<string>(),
      csvTotal: -Infinity,
    };
    a.csvTotal = Math.max(a.csvTotal, p.totalScore);
    a.killScore = Math.max(a.killScore, p.killScore);
    a.kills = Math.max(a.kills, p.teamKills || 0);
    if (p.placement !== null) a.placement = a.placement === null ? p.placement : Math.min(a.placement, p.placement);
    if (p.nickname) a.nicknames.add(normalize(p.nickname));
    byName.set(id, a);
  }
  return byName;
}

const overlap = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
};

type Cluster = { members: Raw[]; rounds: Set<number>; named: boolean };

// 기본 팀명 기록은 "라운드R 이름"을 고정 기준으로 쓰고, 같은 라운드 기록이 둘인 묶음은 만들지 않음
function buildClusters(raws: Raw[]): Cluster[] {
  const isLinkable = (r: Raw) => DEFAULT_TEAM.test(r.name) && r.nicknames.size > 0;
  for (const r of raws) r.base = isLinkable(r) ? `${r.round}R ${r.name}` : r.name;

  const clusters: Cluster[] = [];
  const byName = new Map<string, Cluster>();
  for (const r of raws.filter((x) => !isLinkable(x))) {
    const id = normalize(r.base);
    let c = byName.get(id);
    if (!c) {
      c = { members: [], rounds: new Set(), named: true };
      byName.set(id, c);
      clusters.push(c);
    }
    c.members.push(r);
    c.rounds.add(r.round);
  }

  const loose = raws.filter(isLinkable);
  const nicksOf = (c: Cluster) => {
    const all = new Set<string>();
    for (const m of c.members) for (const n of m.nicknames) all.add(n);
    return all;
  };
  const named = clusters.map((c) => ({ c, nicks: nicksOf(c) }));
  const links: { d: Raw; c: Cluster; score: number }[] = [];
  for (const d of loose) {
    for (const { c, nicks } of named) {
      const o = overlap(d.nicknames, nicks);
      if (o < 2) continue;
      const near = Math.min(...c.members.map((m) => Math.abs(m.round - d.round)));
      links.push({ d, c, score: o * 1000 - near });
    }
  }
  links.sort((x, y) => y.score - x.score);
  const placed = new Set<Raw>();
  for (const { d, c } of links) {
    if (placed.has(d) || c.rounds.has(d.round)) continue;
    c.members.push(d);
    c.rounds.add(d.round);
    placed.add(d);
  }

  const rest = loose.filter((d) => !placed.has(d));
  const own = rest.map((d) => ({ members: [d], rounds: new Set([d.round]), named: false }) as Cluster);
  const parent = own.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const pairs: { i: number; j: number; o: number }[] = [];
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      if (rest[i].round === rest[j].round) continue;
      const o = overlap(rest[i].nicknames, rest[j].nicknames);
      if (o >= 2) pairs.push({ i, j, o });
    }
  }
  pairs.sort((x, y) => y.o - x.o);
  for (const { i, j } of pairs) {
    const a = find(i);
    const b = find(j);
    if (a === b) continue;
    if ([...own[a].rounds].some((r) => own[b].rounds.has(r))) continue;
    parent[b] = a;
    own[a].members.push(...own[b].members);
    for (const r of own[b].rounds) own[a].rounds.add(r);
  }
  own.forEach((c, i) => {
    if (find(i) === i) clusters.push(c);
  });
  for (const c of clusters) c.members.sort((x, y) => x.round - y.round);
  return clusters;
}

function score(a: Raw, rules: Rules) {
  const table = a.source === "manual" || rules.scoreSource === "table";
  const points = a.placement === null ? 0 : (rules.placementPoints[a.placement - 1] ?? 0);
  return {
    score: round2(table ? points + a.killScore * rules.killMultiplier : a.csvTotal),
    rankScore: round2(table ? points : Math.max(0, a.csvTotal - a.killScore)),
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function penaltyPoints(p: PenaltyInput, rules: Rules) {
  if (p.kind === "death") return rules.deathPenalty ? p.count : 0;
  return p.points;
}

export function banRoundsFor(count: number, ban: Ban): number {
  if (ban === "none") return 0;
  if (ban === "basic") return count >= 3 ? 1 : 0;
  if (count >= 5) return 3;
  if (count === 4) return 2;
  if (count === 3) return 1;
  return 0;
}

function rank<T>(items: T[], value: (t: T) => number): (T & { value: number; rank: number })[] {
  const withValue = items.map((t) => ({ ...t, value: value(t) }));
  withValue.sort((a, b) => b.value - a.value);
  let r = 1;
  return withValue.map((t, i) => {
    if (i > 0 && withValue[i - 1].value > t.value) r = i + 1;
    return { ...t, rank: r };
  });
}

export function computeGroup(input: GroupInput): GroupResult {
  const { rules, mode } = input;
  const alias = new Map(Object.entries(input.aliases).map(([k, v]) => [normalize(k), v]));
  const rename = (name: string) => {
    let current = name;
    for (let i = 0; i < 5; i++) {
      const next = alias.get(normalize(current));
      if (!next || normalize(next) === normalize(current)) break;
      current = next;
    }
    return current;
  };

  const ordered = [...input.rounds].sort((a, b) => a.roundNo - b.roundNo);
  const played = ordered.length ? ordered[ordered.length - 1].roundNo : 0;
  const recorded = new Set(ordered.map((r) => r.roundNo)).size;
  const perRound: (Map<string, Agg> | null)[] = Array(played).fill(null);
  const roundByNo = new Map(ordered.map((r) => [r.roundNo, r]));
  const names = new Map<string, string>();
  const baseOf = new Map<string, string>();
  const displayOf = new Map<string, string>();
  const nickTeam = new Map<string, string>();

  const raws: Raw[] = [];
  for (const round of ordered) raws.push(...collect(round).values());
  const clusters = buildClusters(raws);
  const memberKey = new Map<string, string>();

  const basesOf = new Map<string, { round: number; base: string }[]>();
  const manualOnly = (c: Cluster) => c.members.every((m) => m.source === "manual" && m.nicknames.size === 0);
  // 직접 입력에 다른 기록의 기준 이름을 그대로 쓴 경우 그 팀으로 넣기 위해 직접 입력만 있는 묶음을 나중에 처리
  const orderedClusters = [...clusters.filter((c) => !manualOnly(c)), ...clusters.filter(manualOnly)];
  for (const c of orderedClusters) {
    const aliased = c.members.find((m) => alias.has(normalize(m.base)));
    const lead = aliased ?? c.members.find((m) => m.base === m.name) ?? c.members[0];
    const joined = manualOnly(c) && !aliased ? memberKey.get(normalize(lead.base)) : undefined;
    const display = joined ? (names.get(joined) ?? rename(lead.base)) : rename(lead.base);
    const key = joined ?? normalize(display);
    if (!names.has(key)) names.set(key, display);
    if (!baseOf.has(key)) baseOf.set(key, c.members[0].base);
    const list = basesOf.get(key) ?? [];
    for (const m of c.members) {
      if (!memberKey.has(normalize(m.base))) memberKey.set(normalize(m.base), key);
      list.push({ round: m.round, base: m.base });
      displayOf.set(normalize(m.base), display);
      const teams = (perRound[m.round - 1] ??= new Map<string, Agg>());
      const sc = score(m, rules);
      const prev = teams.get(key);
      if (prev) {
        prev.score = Math.max(prev.score, sc.score);
        prev.rankScore = Math.max(prev.rankScore, sc.rankScore);
        prev.killScore = Math.max(prev.killScore, m.killScore);
        prev.kills = Math.max(prev.kills, m.kills);
        if (m.placement !== null) prev.placement = prev.placement === null ? m.placement : Math.min(prev.placement, m.placement);
        for (const n of m.nicknames) prev.nicknames.add(n);
      } else {
        teams.set(key, { ...m, name: display, key, ...sc, nicknames: new Set(m.nicknames) });
      }
      for (const n of m.nicknames) nickTeam.set(n, key);
    }
    basesOf.set(key, list.sort((x, y) => x.round - y.round));
  }
  const refKey = (team: string) => memberKey.get(normalize(team)) ?? normalize(rename(team));
  // 연결할 팀이 없는 감점은 순위표에 빈 팀 행을 만들지 않고 따로 돌려줌
  const allPenalties = input.penalties.map((p) => ({ ...p, key: refKey(p.team) }));
  const penalties = allPenalties.filter((p) => names.has(p.key));
  const orphanPenalties = allPenalties.filter((p) => !names.has(p.key)).map((p) => p.id);
  const overrides = Object.entries(input.overrides).map(([k, v]) => ({
    round: Number(k.split(":")[0]),
    key: refKey(k.slice(k.indexOf(":") + 1)),
    on: v,
  }));

  const keys = [...names.keys()];
  const roundsOf = (key: string) => perRound.map((m) => (m?.get(key) as TeamRound | undefined) ?? null);

  type Row = { key: string; total: number; killScore: number; kills: number; rankScore: number; wins: number; last: number | null; ruleFree: number };
  const totalsAfter = (r: number): Row[] =>
    keys.map((key) => {
      const rs = roundsOf(key).slice(0, r);
      const sum = rs.reduce((a, x) => a + (x?.score ?? 0), 0);
      const pen = penalties.filter((p) => p.key === key && p.roundNo <= r);
      const all = pen.reduce((a, p) => a + penaltyPoints(p, rules), 0);
      const ruleNow = pen.filter((p) => p.kind === "rule" && p.roundNo === r && r > 0).reduce((a, p) => a + p.points, 0);
      const last = [...rs].reverse().find((x) => x !== null);
      return {
        key,
        total: round2(sum - all),
        killScore: round2(rs.reduce((a, x) => a + (x?.killScore ?? 0), 0)),
        kills: rs.reduce((a, x) => a + (x?.kills ?? 0), 0),
        rankScore: round2(rs.reduce((a, x) => a + (x?.rankScore ?? 0), 0)),
        wins: rs.filter((x) => x?.placement === 1).length,
        last: last?.placement ?? null,
        ruleFree: round2(sum - all + ruleNow),
      };
    });

  const primary = rules.tiebreak;
  const compare = (a: Row, b: Row) =>
    b.total - a.total ||
    b[primary] - a[primary] ||
    (primary === "killScore" ? b.kills - a.kills : b.killScore - a.killScore) ||
    (a.last ?? 99) - (b.last ?? 99) ||
    byText(names.get(a.key) ?? "", names.get(b.key) ?? "");

  const fixed: { key: string; round: number }[] = [];
  let status = new Set<string>();
  const statusAt: Set<string>[] = [];
  let ended = mode === "points" ? recorded >= input.plannedRounds && recorded > 0 : false;
  const need = mode === "double" ? 2 : 1;

  const orderFor = (r: number, rows: Row[]) => {
    const fixedKeys = fixed.filter((f) => f.round <= r).map((f) => f.key);
    const rest = rows.filter((x) => !fixedKeys.includes(x.key)).sort(compare);
    return [...fixedKeys.map((k) => rows.find((x) => x.key === k)!).filter(Boolean), ...rest];
  };

  if (mode !== "points") {
    for (let r = 1; r <= played + 1; r++) {
      const rows = totalsAfter(r - 1);
      const fixedKeys = new Set(fixed.map((f) => f.key));
      const open = rows.filter((x) => !fixedKeys.has(x.key));
      const next = new Set<string>();
      if (rules.checkpoint.type === "points") {
        for (const x of open) if (x.total >= rules.checkpoint.points) next.add(x.key);
      } else {
        const seq = rules.checkpoint.sequence.length ? rules.checkpoint.sequence : CHECKPOINT_SEQUENCE;
        const n = seq[Math.min(r - 1, seq.length - 1)] ?? 0;
        const sorted = [...open].sort(compare);
        for (const x of sorted.slice(0, n)) next.add(x.key);
        if (rules.checkpoint.penaltyKeeps && n > 0) {
          const byRuleFree = [...open].sort((a, b) => b.ruleFree - a.ruleFree || compare(a, b)).slice(0, n);
          for (const x of byRuleFree) if (status.has(x.key)) next.add(x.key);
        }
      }
      if (rules.checkpoint.keep) for (const k of status) if (!fixedKeys.has(k)) next.add(k);
      for (const o of overrides) {
        if (o.round !== r) continue;
        if (o.on) next.add(o.key);
        else next.delete(o.key);
      }
      status = next;
      statusAt[r - 1] = status;
      if (r > played || ended) continue;
      const teams = perRound[r - 1];
      if (!teams) continue;
      const winner = [...teams.values()].find((t) => t.placement === 1);
      if (winner && status.has(winner.key) && !fixedKeys.has(winner.key)) {
        fixed.push({ key: winner.key, round: r });
        if (fixed.length >= need) ended = true;
      }
    }
    if (recorded >= input.plannedRounds && recorded > 0) ended = true;
  }

  const now = orderFor(played, totalsAfter(played));
  const prev = played > 1 ? orderFor(played - 1, totalsAfter(played - 1)) : null;
  let firstEmpty = 1;
  while (roundByNo.has(firstEmpty)) firstEmpty++;
  const finalStatus = statusAt[Math.min(firstEmpty, played + 1) - 1] ?? new Set<string>();

  const standings: Standing[] = now.map((x, i) => {
    const rs = roundsOf(x.key);
    const pi = prev ? prev.findIndex((p) => p.key === x.key) : -1;
    const fixedIndex = fixed.findIndex((f) => f.key === x.key);
    const isTied = (o: (typeof now)[number] | undefined) => o !== undefined && o.total === x.total && !fixed.some((f) => f.key === o.key);
    const neighbor = isTied(now[i - 1]) ? now[i - 1] : isTied(now[i + 1]) ? now[i + 1] : undefined;
    let tiedBy: Standing["tiedBy"] = null;
    if (fixedIndex < 0 && neighbor) {
      const second = primary === "killScore" ? "kills" : "killScore";
      tiedBy = neighbor[primary] !== x[primary] ? primary : neighbor[second] !== x[second] ? second : "lastPlacement";
    }
    return {
      key: x.key,
      base: baseOf.get(x.key) ?? names.get(x.key) ?? x.key,
      bases: basesOf.get(x.key) ?? [],
      name: names.get(x.key) ?? x.key,
      rank: i + 1,
      delta: pi >= 0 ? pi - i : 0,
      rounds: rs,
      roundScore: round2(rs.reduce((a, r) => a + (r?.score ?? 0), 0)),
      killScore: x.killScore,
      kills: x.kills,
      rankScore: x.rankScore,
      wins: x.wins,
      penalty: round2(rs.reduce((a, r) => a + (r?.score ?? 0), 0) - x.total),
      total: x.total,
      lastPlacement: x.last,
      checkpoint: !ended && finalStatus.has(x.key),
      fixed: fixedIndex >= 0 ? fixedIndex + 1 : null,
      tiedBy,
    };
  });

  const weatherBy = new Map(input.weather.map((w) => [w.roundNo, w]));
  const mainOf = (r: number) => weatherBy.get(r)?.main ?? defaultMainWeather(r);
  const subOf = (r: number) => weatherBy.get(r)?.sub ?? null;

  const rounds: RoundSummary[] = [];
  for (let r = 1; r <= played; r++) {
    const teams = perRound[r - 1];
    const round = roundByNo.get(r);
    const winner = teams ? [...teams.values()].find((t) => t.placement === 1) : undefined;
    rounds.push({
      roundNo: r,
      gameId: round?.gameId ?? null,
      source: round?.source ?? "csv",
      teamCount: teams?.size ?? 0,
      winner: winner?.name ?? null,
      main: mainOf(r),
      sub: subOf(r),
    });
  }

  const bansByRound = new Map<number, Set<string>>();
  const picks: GroupResult["picks"] = [];
  for (let r = 1; r <= played; r++) {
    const round = roundByNo.get(r);
    if (!round || round.source !== "csv") continue;
    const counts = new Map<string, number>();
    for (const p of round.players) if (p.character) counts.set(p.character, (counts.get(p.character) ?? 0) + 1);
    const list = [...counts.entries()]
      .map(([character, count]) => ({ character, count, banRounds: banRoundsFor(count, rules.bans) }))
      .sort((a, b) => b.count - a.count || byText(a.character, b.character));
    picks.push({ roundNo: r, counts: list });
    for (const c of list) {
      for (let k = 1; k <= c.banRounds; k++) {
        const set = bansByRound.get(r + k) ?? new Set<string>();
        set.add(c.character);
        bansByRound.set(r + k, set);
      }
    }
  }

  let next: NextRound | null = null;
  let nextNo = 1;
  while (roundByNo.has(nextNo)) nextNo++;
  if (!ended && nextNo <= input.plannedRounds) {
    const cycleStart = Math.floor((nextNo - 1) / SUB_WEATHERS.length) * SUB_WEATHERS.length + 1;
    const used = new Set<string>();
    for (let r = cycleStart; r < nextNo; r++) {
      const s = subOf(r);
      if (s) used.add(s);
    }
    next = {
      roundNo: nextNo,
      main: mainOf(nextNo),
      sub: subOf(nextNo),
      subRemaining: rules.subWeather ? SUB_WEATHERS.filter((s) => !used.has(s)) : [],
      bans: [...(bansByRound.get(nextNo) ?? [])],
      checkpoint: mode === "points" ? [] : standings.filter((s) => s.checkpoint).map((s) => s.name),
      // 마스터즈 규정 2.5.3: 체크포인트 팀 중 최고 점수 팀이 다음 라운드 메인 날씨 선택
      weatherPick: mode === "points" ? null : (standings.find((s) => s.checkpoint)?.name ?? null),
    };
  }

  type Acc = { nickname: string; team: string; rounds: number; kills: number };
  const acc = new Map<string, Acc>();
  for (let r = 1; r <= played; r++) {
    const round = roundByNo.get(r);
    if (!round || round.source !== "csv") continue;
    for (const p of round.players) {
      if (!p.nickname) continue;
      const id = normalize(p.nickname);
      const teamKey = nickTeam.get(id);
      const team = teamKey ? (names.get(teamKey) ?? p.team) : rename(p.team.trim());
      const a = acc.get(id) ?? { nickname: p.nickname, team, rounds: 0, kills: 0 };
      a.rounds++;
      a.kills += p.kills;
      a.team = team;
      acc.set(id, a);
    }
  }
  const players = rank([...acc.values()], (a) => round2(a.kills / a.rounds))
    .filter((a) => a.rank <= 10)
    .map((a) => ({ nickname: a.nickname, team: a.team, rounds: a.rounds, kills: a.kills, value: a.value, rank: a.rank }));

  return {
    standings,
    displayOf,
    orphanPenalties,
    rounds,
    played,
    next,
    ended,
    picks,
    players,
  };
}

export { MAIN_WEATHERS, SUB_WEATHERS };

export function groupResult(view: TournamentView, idx: number): GroupResult {
  const g = view.groups[idx];
  return computeGroup({
    mode: view.mode,
    rules: view.rules,
    plannedRounds: view.plannedRounds,
    rounds: g.rounds,
    penalties: g.penalties,
    weather: g.weather,
    aliases: g.aliases,
    overrides: g.overrides,
  });
}
