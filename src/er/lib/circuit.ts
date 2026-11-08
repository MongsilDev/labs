import { rng, shuffle } from "./random";

export type CircuitTeam = { name: string; points: number };
export type CircuitSetup = { teams: CircuitTeam[]; table: number[]; left: number; spots: number };
export type CircuitOdds = { p: number[]; sure: boolean[]; never: boolean[] };

export const CIRCUIT_LIMITS = { teams: 64, left: 20, points: 100_000 } as const;
export const RUNS = 100_000;

// 큰 입력은 브라우저가 1초 안에 끝내도록 횟수를 줄임, 2만 번이면 표준오차 0.4%p 이하
export const runsFor = (teams: number, left: number) => Math.max(20_000, Math.min(RUNS, Math.ceil(2e7 / (teams * (left + 1)))));

const num = (s: string) => (/^-?\d+$/.test(s) ? Number(s) : NaN);

// 한 줄에 팀 하나, 마지막 숫자가 포인트이고 나머지가 팀 이름
export function parseTeams(text: string): { teams: CircuitTeam[]; bad: number[] } {
  const teams: CircuitTeam[] = [];
  const bad: number[] = [];
  text.split("\n").forEach((line, i) => {
    const m = line.trim().match(/^(.*?)[\s,\t]+(-?\d+)$/);
    if (!line.trim()) return;
    if (!m || !m[1].trim()) bad.push(i + 1);
    else teams.push({ name: m[1].trim().replace(/[,\t]+$/, "").trim(), points: Number(m[2]) });
  });
  return { teams, bad };
}

export function parseTable(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(num);
}

export function problem({ teams, table, left, spots }: CircuitSetup, bad: number[] = []): string | null {
  if (bad.length) return `${bad.slice(0, 3).join(", ")}번째 줄에서 팀 이름과 포인트를 읽지 못했습니다. 팀 이름 뒤에 포인트를 숫자로 적어주세요.`;
  if (teams.length < 2) return "팀을 두 팀 이상 넣어주세요.";
  if (teams.length > CIRCUIT_LIMITS.teams) return `팀을 ${CIRCUIT_LIMITS.teams}팀 이하로 줄여주세요.`;
  if (new Set(teams.map((t) => t.name)).size < teams.length) return "같은 이름의 팀이 있습니다. 팀 이름을 서로 다르게 적어주세요.";
  if (teams.some((t) => Math.abs(t.points) > CIRCUIT_LIMITS.points)) return `포인트는 ${CIRCUIT_LIMITS.points.toLocaleString("ko-KR")} 이하로 넣어주세요.`;
  if (!Number.isInteger(left) || left < 0 || left > CIRCUIT_LIMITS.left) return `남은 대회는 0~${CIRCUIT_LIMITS.left}개로 넣어주세요.`;
  if (!Number.isInteger(spots) || spots < 1 || spots >= teams.length) return `진출 팀 수는 1~${teams.length - 1}팀으로 넣어주세요.`;
  if (left > 0 && table.some((v) => !Number.isFinite(v) || Math.abs(v) > CIRCUIT_LIMITS.points)) return "순위별 포인트는 정수만 쉼표로 나눠 넣어주세요.";
  if (left > 0 && table.length < teams.length) return `순위별 포인트를 ${teams.length}위까지 넣어주세요. 지금은 ${table.length}위까지 있습니다.`;
  return null;
}

// 남은 대회 결과와 관계없이 정해지는 경우만, 동점은 진출하지 못할 수 있다고 봄
export function certainty({ teams, table, left, spots }: CircuitSetup): Pick<CircuitOdds, "sure" | "never"> {
  const used = table.slice(0, teams.length);
  const lo = teams.map((t) => t.points + (left ? left * Math.min(...used) : 0));
  const hi = teams.map((t) => t.points + (left ? left * Math.max(...used) : 0));
  const sure = teams.map((_, t) => lo.filter((_, j) => j !== t && hi[j] >= lo[t]).length < spots);
  const never = teams.map((_, t) => lo.filter((v, j) => j !== t && v > hi[t]).length >= spots);
  return { sure, never };
}

// 남은 대회마다 모든 순위를 같은 확률로 뽑고, 합계 동점은 무작위로 가름
export function circuitOdds(setup: CircuitSetup, runs = runsFor(setup.teams.length, setup.left), seed = 1): CircuitOdds {
  const { teams, table, left, spots } = setup;
  const n = teams.length;
  const r = rng(seed);
  const made = new Float64Array(n);
  const total = new Float64Array(n);
  const keys = new Float64Array(n);
  const perm = teams.map((_, i) => i);
  const tie = teams.map((_, i) => i);
  const base = -CIRCUIT_LIMITS.points * (left + 1);
  for (let k = 0; k < runs; k++) {
    for (let t = 0; t < n; t++) total[t] = teams[t].points;
    for (let e = 0; e < left; e++) {
      shuffle(perm, r);
      for (let i = 0; i < n; i++) total[perm[i]] += table[i];
    }
    shuffle(tie, r);
    // 정수 포인트, 동점 순서, 팀 번호를 한 수에 담아 기본 숫자 정렬로 줄 세움
    for (let i = 0; i < n; i++) {
      const t = tie[i];
      keys[i] = ((total[t] - base) * n + i) * CIRCUIT_LIMITS.teams + t;
    }
    keys.sort();
    for (let i = n - spots; i < n; i++) made[keys[i] % CIRCUIT_LIMITS.teams]++;
  }
  const { sure, never } = certainty(setup);
  return { p: Array.from(made, (m) => m / runs), sure, never };
}
