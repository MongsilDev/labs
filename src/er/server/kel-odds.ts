import "server-only";
import { circuitPoints, EVENT_NAME, josa, KEL_TEAMS, QUALIFY, SEEDS } from "@/er/lib/kel";
import { CIRCUIT_STAGES, type Kel } from "./kel";

type Stage = (typeof CIRCUIT_STAGES)[number];
type Bracket = Record<Stage, number[]>;
// ranks[팀][서킷-1]은 서킷 최종 순위, brackets[서킷-1]은 단계마다 경기를 치른 팀 번호
type OddsInput = { ranks: number[][]; brackets: Bracket[] };
// done은 서킷 안에서 끝난 단계 수
type View = { circuit: number; done: number };
// 결승 직행, 준결승, 탈락
type Buckets = [number, number, number];
export type TeamOdds = { p: Buckets; sure: boolean[]; never: boolean[] };
export type OddsView = View & { date: string; teams: TeamOdds[] };
export type Odds = { input: OddsInput; views: OddsView[]; cases: Map<number, string[]> };

const N = 16;
const LAST = 4;
const RUNS = 100_000;
// 계산하는 동안 다른 요청이 기다리지 않게 중간중간 양보
const pause = () => new Promise<void>((r) => setImmediate(r));
const pts = Array.from({ length: LAST + 1 }, (_, c) => Array.from({ length: N + 1 }, (_, r) => (c && r ? circuitPoints(c, r) : 0)));

// 그 단계에 남은 팀이 받을 수 있는 가장 낮은 순위
const WORST: Record<Stage, number> = { A조: N, B조: N, 승자조: 12, 패자조: N, 최종전: 12, 결승: 8 };

// 끝난 단계까지 보고 팀이 다음에 치를 단계, 서킷 순위가 정해졌으면 null
function nextStage(input: OddsInput, c: number, done: number, t: number): Stage | null {
  const path = CIRCUIT_STAGES.filter((s) => input.brackets[c - 1][s].includes(t));
  return path.find((s) => CIRCUIT_STAGES.indexOf(s) >= done) ?? null;
}

// 끝난 단계까지로 정해진 서킷 순위 구간
export function interval(input: OddsInput, c: number, done: number, t: number): [number, number] {
  const s = nextStage(input, c, done, t);
  const rank = input.ranks[t][c - 1];
  return s ? [1, WORST[s]] : [rank, rank];
}

// 진행 중인 서킷 칸에 쓰는 지금 위치
export function status(input: OddsInput, { circuit: c, done }: View, t: number): string {
  const s = nextStage(input, c, done, t);
  return s ? `${s} 경기 전` : `${input.ranks[t][c - 1]}위`;
}

// 지난 서킷 포인트에 진행 중인 서킷에서 지금 위치로 받을 수 있는 가장 낮은 포인트를 더한 값
export function guaranteed(input: OddsInput, { circuit: c, done }: View, t: number): number {
  return known(input, c)[t] + pts[c][interval(input, c, done, t)[1]];
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

function shuffle(a: number[], r: () => number): number[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 끝나지 않은 단계의 진출 팀과 그 안의 순위는 모두 같은 확률로 뽑음
function circuitPlan(input: OddsInput, c: number, done: number): (r: () => number, ranks: Int8Array) => void {
  const b = input.brackets[c - 1];
  const has = (s: Stage, t: number) => b[s].includes(t);
  const byRank = (list: number[]) => [...list].sort((x, y) => input.ranks[x][c - 1] - input.ranks[y][c - 1]);
  // 끝난 단계는 [올라간 팀, 남은 팀]으로 미리 나눔
  const split = (ready: boolean, list: number[], keep: (t: number) => boolean) => (ready ? [list.filter(keep), list.filter((t) => !keep(t))] : null);
  const groupA = split(done >= 1, b["A조"], (t) => has("승자조", t));
  const groupB = split(done >= 2, b["B조"], (t) => has("승자조", t));
  const upper = split(done >= 3, b["승자조"], (t) => !has("최종전", t));
  const lower = split(done >= 4, b["패자조"], (t) => has("최종전", t));
  const lastChance = split(done >= 5, b["최종전"], (t) => has("결승", t));
  const fin = done >= 6 ? byRank(b["결승"]) : null;
  const out = lower && byRank(lower[1]);
  const nine = lastChance && byRank(lastChance[1]);
  const pick = (fixed: number[][] | null, list: number[], r: () => number) => fixed ?? ((s) => [s.slice(0, 4), s.slice(4)])(shuffle([...list], r));
  return (r, ranks) => {
    const [upA, loA] = pick(groupA, b["A조"], r);
    const [upB, loB] = pick(groupB, b["B조"], r);
    const [finUp, lcUp] = pick(upper, [...upA, ...upB], r);
    const [lcLo, rest] = pick(lower, [...loA, ...loB], r);
    const [finLc, left] = pick(lastChance, [...lcUp, ...lcLo], r);
    const order = [...(fin ?? shuffle([...finUp, ...finLc], r)), ...(nine ?? left), ...(out ?? rest)];
    for (let i = 0; i < N; i++) ranks[order[i]] = i + 1;
  };
}

function validBracket(input: OddsInput, c: number): boolean {
  const b = input.brackets[c - 1];
  const both = (x: number[], y: number[]) => x.filter((t) => y.includes(t)).length;
  const ok =
    CIRCUIT_STAGES.every((s) => new Set(b[s]).size === 8) &&
    new Set([...b["A조"], ...b["B조"]]).size === N &&
    new Set([...b["승자조"], ...b["패자조"]]).size === N &&
    both(b["A조"], b["승자조"]) === 4 &&
    both(b["승자조"], b["최종전"]) === 4 &&
    both(b["패자조"], b["최종전"]) === 4 &&
    both(b["최종전"], b["결승"]) === 4 &&
    b["승자조"].filter((t) => !b["최종전"].includes(t)).every((t) => b["결승"].includes(t));
  if (!ok) return false;
  const ranks = new Int8Array(N);
  circuitPlan(input, c, 6)(() => 0, ranks);
  return ranks.every((r, t) => r === input.ranks[t][c - 1]);
}

function known(input: OddsInput, c: number): Int32Array {
  const base = new Int32Array(N);
  for (let k = 1; k < c; k++) for (let t = 0; t < N; t++) base[t] += pts[k][input.ranks[t][k - 1]];
  return base;
}

// 시즌 순위는 포인트, 같으면 마지막 서킷 순위
function bucketsOf(score: Int32Array, last: ArrayLike<number>, add: (t: number, b: number) => void) {
  const order = new Int8Array(N);
  for (let t = 0; t < N; t++) {
    let j = t - 1;
    while (j >= 0 && (score[order[j]] < score[t] || (score[order[j]] === score[t] && last[order[j]] > last[t]))) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = t;
  }
  for (let i = 0; i < N; i++) add(order[i], i < SEEDS ? 0 : i < QUALIFY ? 1 : 2);
}

async function simulate(input: OddsInput, { circuit, done }: View, runs: number): Promise<Buckets[]> {
  const r = rng(7919 + circuit * 31 + done);
  const now = circuitPlan(input, circuit, done);
  const base = known(input, circuit);
  const ranks = Array.from({ length: LAST + 1 }, () => new Int8Array(N));
  const score = new Int32Array(N);
  const count = Array.from({ length: N }, () => [0, 0, 0] as Buckets);
  const perm = Array.from({ length: N }, (_, t) => t);
  for (let it = 0; it < runs; it++) {
    if (it && it % 1_000 === 0) await pause();
    now(r, ranks[circuit]);
    for (let c = circuit + 1; c <= LAST; c++) shuffle(perm, r).forEach((t, i) => (ranks[c][t] = i + 1));
    for (let t = 0; t < N; t++) {
      score[t] = base[t];
      for (let c = circuit; c <= LAST; c++) score[t] += pts[c][ranks[c][t]];
    }
    bucketsOf(score, ranks[LAST], (t, b) => count[t][b]++);
  }
  return count.map((c) => c.map((x) => x / runs) as Buckets);
}

// 처지가 같은 팀은 확률도 같아야 해서 시뮬레이션 값을 묶어 평균
function pooled(input: OddsInput, view: View, p: Buckets[]): Buckets[] {
  const { circuit: c, done } = view;
  const base = known(input, c);
  const groups = Map.groupBy(p.keys(), (t) => {
    const s = nextStage(input, c, done, t);
    if (s) return `${base[t]}:${s}`;
    // 이번 서킷 순위가 정해진 팀은 서킷 4가 남아 있으면 포인트 합계만으로 처지가 갈림
    return c < LAST ? `${base[t] + pts[c][input.ranks[t][c - 1]]}` : `#${t}`;
  });
  const out = [...p];
  for (const team of groups.values()) {
    const mean = [0, 1, 2].map((b) => team.reduce((s, t) => s + p[t][b], 0) / team.length) as Buckets;
    for (const t of team) out[t] = mean;
  }
  return out;
}

function* permutations(a: number[], n = a.length): Generator<number[]> {
  if (n <= 1) {
    yield a;
    return;
  }
  for (let i = 0; i < n; i++) {
    yield* permutations(a, n - 1);
    const j = n % 2 ? 0 : i;
    [a[n - 1], a[j]] = [a[j], a[n - 1]];
  }
}

// 마지막 서킷 결승만 남았을 때는 결승 순위 8! 경우를 모두 셈. byRank[팀][결승 순위]는 그 순위일 때의 결과 수
function enumerateFinal(input: OddsInput) {
  const base = known(input, LAST);
  const finalists = input.brackets[LAST - 1]["결승"];
  const last = Int8Array.from({ length: N }, (_, t) => input.ranks[t][LAST - 1]);
  const score = new Int32Array(N);
  const count = Array.from({ length: N }, () => [0, 0, 0] as Buckets);
  const byRank = Array.from({ length: N }, () => Array.from({ length: 9 }, () => [0, 0, 0] as Buckets));
  let total = 0;
  for (const order of permutations([1, 2, 3, 4, 5, 6, 7, 8])) {
    finalists.forEach((t, i) => (last[t] = order[i]));
    for (let t = 0; t < N; t++) score[t] = base[t] + pts[LAST][last[t]];
    bucketsOf(score, last, (t, b) => {
      count[t][b]++;
      if (finalists.includes(t)) byRank[t][last[t]][b]++;
    });
    total++;
  }
  return { p: count.map((c) => c.map((x) => x / total) as Buckets), byRank, finalists };
}

// 최소 비용 완전 배정(헝가리안 방법)
function assign(cost: number[][]): number {
  const n = cost.length;
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  let total = 0;
  for (let j = 1; j <= n; j++) total += cost[p[j] - 1][j - 1];
  return total;
}

// miss: k위 안에 못 들 가능성, make: k위 안에 들 가능성
type Reach = { miss: boolean; make: boolean };
const BLOCK = 1e6;

// 남은 서킷이 하나면 팀마다 순위 구간 안에서 남은 순위를 배정해 보고 정확히 판정
function exact(input: OddsInput, view: View, c: number, k: number): Reach[] {
  const base = known(input, c);
  const iv = Array.from({ length: N }, (_, t) => interval(input, c, view.circuit === c ? view.done : 0, t));
  return Array.from({ length: N }, (_, t) => {
    const res = { miss: false, make: false };
    const others = Array.from({ length: N }, (_, u) => u).filter((u) => u !== t);
    for (let r = iv[t][0]; r <= iv[t][1]; r++) {
      const mine = base[t] + pts[c][r];
      const slots = Array.from({ length: N }, (_, i) => i + 1).filter((s) => s !== r);
      const ahead = (u: number, s: number) => base[u] + pts[c][s] > mine || (base[u] + pts[c][s] === mine && s < r);
      const fits = (u: number, s: number) => s >= iv[u][0] && s <= iv[u][1];
      const behind = assign(others.map((u) => slots.map((s) => (fits(u, s) ? (ahead(u, s) ? 0 : 1) : BLOCK))));
      if (behind < BLOCK && others.length - behind >= k) res.miss = true;
      const fewest = assign(others.map((u) => slots.map((s) => (fits(u, s) ? (ahead(u, s) ? 1 : 0) : BLOCK))));
      if (fewest < BLOCK && fewest <= k - 1) res.make = true;
    }
    return res;
  });
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const largest = (vals: number[], k: number) => sum([...vals].sort((a, b) => b - a).slice(0, k));
const without = (vals: number[], v: number) => {
  const i = vals.indexOf(v);
  return i < 0 ? vals : [...vals.slice(0, i), ...vals.slice(i + 1)];
};

// 서킷이 둘 이상 남으면 넉넉하게 어림해서, 불가능하다고 나온 쪽만 확정에 씀
function bound(input: OddsInput, view: View, k: number): Reach[] {
  const range = Array.from({ length: N }, (_, u) =>
    Array.from({ length: LAST + 1 }, (_, c): [number, number] =>
      !c ? [0, 0] : c < view.circuit ? [input.ranks[u][c - 1], input.ranks[u][c - 1]] : interval(input, c, c === view.circuit ? view.done : 0, u),
    ),
  );
  const open = (u: number, c: number) => range[u][c][0] < range[u][c][1];
  const settled = (u: number) => {
    let s = 0;
    for (let c = 1; c <= LAST; c++) if (!open(u, c)) s += pts[c][range[u][c][0]];
    return s;
  };
  const pools = Array.from({ length: LAST + 1 }, (_, c) => {
    if (!c) return [];
    const taken = new Set<number>();
    for (let u = 0; u < N; u++) if (!open(u, c)) taken.add(range[u][c][0]);
    return Array.from({ length: N }, (_, i) => i + 1)
      .filter((r) => !taken.has(r))
      .map((r) => pts[c][r]);
  });
  return Array.from({ length: N }, (_, t) => {
    let worst = settled(t);
    const capPools: number[][] = [];
    for (let c = 1; c <= LAST; c++) {
      if (!open(t, c)) {
        capPools.push(pools[c]);
        continue;
      }
      const v = pts[c][range[t][c][1]];
      worst += v;
      capPools.push(without(pools[c], v));
    }
    const need: number[] = [];
    for (let u = 0; u < N; u++) {
      if (u === t) continue;
      let gain = 0;
      for (let c = 1; c <= LAST; c++) if (open(u, c)) gain += pts[c][range[u][c][0]];
      const d = worst - settled(u);
      if (d <= gain) need.push(Math.max(0, d));
    }
    need.sort((a, b) => a - b);
    const chosen = need.slice(0, k).sort((a, b) => b - a);
    let miss = need.length >= k;
    for (let j = 1; miss && j <= k; j++) miss = sum(chosen.slice(0, j)) <= sum(capPools.map((vals) => largest(vals, j)));
    let best = settled(t);
    const left: number[][] = [];
    for (let c = 1; c <= LAST; c++) {
      let vals = pools[c];
      if (open(t, c)) {
        const v = pts[c][range[t][c][0]];
        best += v;
        vals = without(vals, v);
      }
      left.push(vals);
    }
    let forced = 0;
    const slack: number[] = [];
    for (let u = 0; u < N; u++) {
      if (u === t) continue;
      let low = 0;
      for (let c = 1; c <= LAST; c++) if (open(u, c)) low += pts[c][range[u][c][1]];
      if (settled(u) + low > best) forced++;
      else slack.push(best - settled(u));
    }
    let make = forced <= k - 1;
    if (make) {
      slack.sort((a, b) => b - a);
      const safe = slack.slice(0, Math.max(0, slack.length - (k - 1 - forced)));
      make = sum(left.map((vals) => sum(vals) - largest(vals, k - 1))) <= sum(safe);
    }
    return { miss, make };
  });
}

function certainty(input: OddsInput, view: View): Pick<TeamOdds, "sure" | "never">[] {
  const openCircuits: number[] = [];
  for (let c = view.circuit; c <= LAST; c++) {
    const done = c === view.circuit ? view.done : 0;
    if (Array.from({ length: N }, (_, t) => interval(input, c, done, t)).some(([lo, hi]) => lo < hi)) openCircuits.push(c);
  }
  const judge = (k: number) => (openCircuits.length <= 1 ? exact(input, view, openCircuits[0] ?? LAST, k) : bound(input, view, k));
  const seed = judge(SEEDS);
  const qualify = judge(QUALIFY);
  return seed.map((d, t) => {
    const q = qualify[t];
    return {
      sure: [!d.miss, !d.make && !q.miss, !q.make],
      never: [!d.make, !d.miss || !q.make, !q.miss],
    };
  });
}

const within = (r: number) => (r === 1 ? "1위를 차지하면" : `${r}위 안에 들면`);
const short = (r: number) => (r === 1 ? "1위를 차지하지 못하면" : `${r}위 안에 들지 못하면`);

// 마지막 서킷 결승만 남은 시점에 순위 하나로 갈리는 조건과, 결승에 못 오른 팀이 탈락하는 조건
function cases(input: OddsInput, final: ReturnType<typeof enumerateFinal>): Map<number, string[]> {
  const out = new Map<number, string[]>();
  const { p, byRank, finalists } = final;
  const where = `${EVENT_NAME.c4} 결승`;
  for (const t of finalists) {
    const at = byRank[t];
    // 1위부터 조건이 계속 맞는 마지막 순위
    const run = (ok: (v: Buckets) => boolean) => {
      let k = 0;
      while (k < 8 && ok(at[k + 1])) k++;
      return k;
    };
    // 8위까지 이어서 그 결과가 한 번도 없는 구간의 첫 순위
    const from = (f: (v: Buckets) => number) => {
      for (let k = 2; k <= 8; k++) if (at.slice(k).every((v) => f(v) === 0)) return k;
      return 0;
    };
    const lines: string[] = [];
    if (p[t][0] > 0 && p[t][0] < 1) {
      const d = run((v) => !v[1] && !v[2]);
      if (d) lines.push(`${within(d)} 결승 직행이 확정됩니다.`);
      const k = from((v) => v[0]);
      if (k) lines.push(`${short(k - 1)} 결승에 직행할 수 없습니다.`);
    }
    if (p[t][2] > 0 && p[t][2] < 1) {
      const s = run((v) => v[2] === 0);
      if (s) lines.push(`${within(s)} 챔피언십 진출이 확정됩니다.`);
      const k = from((v) => v[0] + v[1]);
      if (k) lines.push(`${short(k - 1)} 챔피언십에 진출하지 못합니다.`);
    }
    if (lines.length) out.set(t, [`${where}에서 ${lines[0]}`, ...lines.slice(1)]);
  }
  const base = known(input, LAST);
  const last = (t: number) => input.ranks[t][LAST - 1];
  for (let t = 0; t < N; t++) {
    if (finalists.includes(t) || !(p[t][2] > 0 && p[t][2] < 1)) continue;
    const mine = base[t] + pts[LAST][last(t)];
    const ahead = (u: number, r: number) => base[u] + pts[LAST][r] > mine || (base[u] + pts[LAST][r] === mine && r < last(t));
    const above = Array.from({ length: N }, (_, u) => u).filter((u) => u !== t && !finalists.includes(u) && ahead(u, last(u))).length;
    const reach = finalists.map((u) => ({ u, r: [1, 2, 3, 4, 5, 6, 7, 8].filter((r) => ahead(u, r)).length })).filter((x) => x.r > 0);
    const maybe = reach.filter((x) => x.r < 8);
    const need = QUALIFY - above - (reach.length - maybe.length);
    // 넘을 수 있는 팀이 모두 넘어야 탈락할 때만 문장으로 씀
    if (!need || need !== maybe.length) continue;
    const parts = maybe.map(({ u, r }, i) => `${josa(KEL_TEAMS[u].name, "이", "가")} ${i ? "" : `${where} `}${r === 1 ? "1위에" : `${r}위 안에`}`);
    out.set(t, [`${josa(KEL_TEAMS[t].name, "은", "는")} ${parts.join(", ")} ${need > 1 ? "함께 " : ""}들면 챔피언십에 진출하지 못합니다.`]);
  }
  return out;
}

// 서킷마다 단계별 경기 기록이 다 있고 최종 순위와 맞을 때만 계산
function inputOf(data: Kel): { input: OddsInput; dates: Map<string, string> } | null {
  const index = new Map(KEL_TEAMS.map((t, i) => [t.key, i]));
  const dates = new Map<string, string>();
  const brackets = [1, 2, 3, 4].map((c) => {
    const sets = Object.fromEntries(CIRCUIT_STAGES.map((s) => [s, new Set<number>()])) as Record<Stage, Set<number>>;
    for (const g of data.games) {
      const t = index.get(g.team);
      if (g.event !== `c${c}` || t === undefined || !(g.stage in sets)) continue;
      sets[g.stage as Stage].add(t);
      const key = `${c}:${g.stage}`;
      if ((dates.get(key) ?? "") < g.date) dates.set(key, g.date);
    }
    return Object.fromEntries(CIRCUIT_STAGES.map((s) => [s, [...sets[s]].sort((x, y) => x - y)])) as Bracket;
  });
  const input = { ranks: KEL_TEAMS.map((t) => [...t.circuits]), brackets };
  return [1, 2, 3, 4].every((c) => validBracket(input, c)) ? { input, dates } : null;
}

async function compute(input: OddsInput, dates: Map<string, string>): Promise<Odds> {
  const final = enumerateFinal(input);
  await pause();
  const views: OddsView[] = [];
  for (let circuit = 1; circuit <= LAST; circuit++) {
    for (let done = 1; done <= 6; done++) {
      const view = { circuit, done };
      const last = circuit === LAST;
      const p = last && done === 5 ? final.p : pooled(input, view, await simulate(input, view, last && done === 6 ? 1 : RUNS));
      const cert = certainty(input, view);
      views.push({ ...view, date: dates.get(`${circuit}:${CIRCUIT_STAGES[done - 1]}`) ?? "", teams: p.map((x, t) => ({ p: x, ...cert[t] })) });
      await pause();
    }
  }
  return { input, views, cases: cases(input, final) };
}

// 서버 시작 때 미리 계산한 결과를 페이지도 쓰도록 globalThis에 둠
const store = globalThis as unknown as { __kelOdds?: { key: string; odds: Promise<Odds> } };

// 계산에 쓰는 대진과 순위가 같으면 한 번만 계산
export function kelOdds(data: Kel): Promise<Odds | null> {
  const built = inputOf(data);
  if (!built) return Promise.resolve(null);
  const key = JSON.stringify([built.input, [...built.dates]]);
  let entry = store.__kelOdds;
  if (entry?.key !== key) {
    const fresh = (entry = { key, odds: compute(built.input, built.dates) });
    store.__kelOdds = fresh;
    fresh.odds.catch(() => {
      if (store.__kelOdds === fresh) store.__kelOdds = undefined;
    });
  }
  return entry.odds;
}
