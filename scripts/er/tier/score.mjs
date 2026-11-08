// in1000 경기 행으로 매기는 실험체와 무기 조합 티어. 계산 방법 설명은 /er/tier 화면 아래쪽

export const RULE = { cap: 0.2, kMin: 50, kMax: 2000, thin: 30 };

/** 표준화 점수 z의 등급 경계 */
export const GRADES = [
  ["S", 1.0],
  ["A", 0.3],
  ["B", -0.3],
  ["C", -1.0],
];

export function grade(z) {
  for (const [g, min] of GRADES) if (z >= min) return g;
  return "D";
}

/** 한 사람의 몫을 표본의 cap 비율까지만 세는 가중치 */
export function playerWeights(rows, cap) {
  const count = new Map();
  for (const r of rows) count.set(r.player, (count.get(r.player) ?? 0) + 1);
  const limit = Math.max(1, cap * rows.length);
  return rows.map((r) => Math.min(1, limit / count.get(r.player)));
}

function summarize(rows, base, cap) {
  const w = playerWeights(rows, cap);
  let W = 0;
  let W2 = 0;
  let sum = 0;
  for (let i = 0; i < rows.length; i++) {
    W += w[i];
    W2 += w[i] ** 2;
    sum += w[i] * (rows[i].gain - base);
  }
  const dev = sum / W;
  let ss = 0;
  for (let i = 0; i < rows.length; i++) ss += w[i] * (rows[i].gain - base - dev) ** 2;
  const n = rows.length;
  return {
    n,
    W,
    eff: W ** 2 / W2,
    dev,
    raw: rows.reduce((a, r) => a + r.gain - base, 0) / n,
    ss,
    players: new Set(rows.map((r) => r.player)).size,
    top: Math.max(...countBy(rows, (r) => r.player).values()) / n,
    place: rows.reduce((a, r) => a + r.rank, 0) / n,
    top3: rows.filter((r) => r.rank <= 3).length / n,
    win: rows.filter((r) => r.rank === 1).length / n,
  };
}

function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

/** 조합 안 분산과 조합 사이 분산의 비율 k, 표본 thin 이상인 조합으로 추정. k판 미만 조합은 점수의 절반 넘게 실험체 값 쪽 */
export function estimateK(groups, rule = RULE) {
  const within = groups.reduce((a, g) => a + g.ss, 0) / groups.reduce((a, g) => a + g.W, 0);
  const big = groups.filter((g) => g.n >= rule.thin);
  if (big.length < 3 || !(within > 0)) return { k: rule.kMax, within, between: 0 };
  const mean = big.reduce((a, g) => a + g.dev, 0) / big.length;
  const spread = big.reduce((a, g) => a + (g.dev - mean) ** 2, 0) / big.length;
  const noise = big.reduce((a, g) => a + within / g.eff, 0) / big.length;
  const between = spread - noise;
  const k = between > 0 ? within / between : rule.kMax;
  return { k: Math.min(rule.kMax, Math.max(rule.kMin, k)), within, between: Math.max(0, between) };
}

/** rows의 gain은 입장료 차감 전 RP(mmrGainInGame). 실험체 점수는 0 쪽, 조합 점수는 그 실험체 점수 쪽으로 수축. rule.k가 있으면 추정 대신 그 값 */
export function scoreRows(rows, rule = RULE) {
  if (!rows.length) return null;
  const base = rows.reduce((a, r) => a + r.gain, 0) / rows.length;
  const games = new Set(rows.map((r) => r.game)).size;
  const combos = [...groupBy(rows, (r) => `${r.char}:${r.weapon}`)].map(([key, rs]) => ({
    char: rs[0].char,
    weapon: rs[0].weapon,
    key,
    ...summarize(rs, base, rule.cap),
  }));
  const est = estimateK(combos, rule);
  const k = rule.k ?? est.k;
  const { within, between } = est;
  const chars = new Map([...groupBy(rows, (r) => r.char)].map(([c, rs]) => {
    const s = summarize(rs, base, rule.cap);
    return [c, (s.eff * s.dev) / (s.eff + k)];
  }));
  for (const c of combos) c.score = (c.eff * c.dev + k * chars.get(c.char)) / (c.eff + k);
  const total = combos.reduce((a, c) => a + c.n, 0);
  const mu = combos.reduce((a, c) => a + c.n * c.score, 0) / total;
  const sd = Math.sqrt(combos.reduce((a, c) => a + c.n * (c.score - mu) ** 2, 0) / total) || 1;
  for (const c of combos) {
    c.z = (c.score - mu) / sd;
    c.grade = grade(c.z);
    c.pick = c.n / rows.length;
  }
  combos.sort((a, b) => b.score - a.score || b.n - a.n);
  return { base, games, rows: rows.length, k, within, between, combos };
}
