// 상위 1,000명이 참가한 경기의 참가자 전원 행으로 매기는 실험체와 무기 조합 티어. 계산 방법 설명은 /er/tier 화면 아래쪽

/** weights는 지표별 비중. 12.7 패치 백테스트에서 다음 날 RP는 RP만 쓸 때와 같고 평균 순위와 TOP3는 더 잘 맞힌 비율 */
/** bands는 시작 RP 구간 경계. 구간 평균을 빼야 낮은 RP 참가자가 많은 조합이 유리해지지 않음 */
export const RULE = {
  cap: 0.2,
  kMin: 50,
  kMax: 2000,
  thin: 30,
  few: 10,
  weights: { gain: 0.75, place: 0.125, top3: 0.125 },
  bands: [7000, 7600, 7800, 8000, 8200, 8400, 8600, 8800, 9000, 9400],
};

/** 지표마다 클수록 좋은 값. bg, bp, bt는 bandAdjust가 붙인 구간 평균과 전체 평균의 차이 */
const METRICS = {
  gain: (r) => r.gain - (r.bg ?? 0),
  place: (r) => -r.rank + (r.bp ?? 0),
  top3: (r) => (r.rank <= 3 ? 1 : 0) - (r.bt ?? 0),
};
const NAMES = Object.keys(METRICS);

/** 표준화 점수 z의 등급 경계 */
export const GRADES = [
  ["S", 1.0],
  ["A", 0.3],
  ["B", -0.3],
  ["C", -1.0],
];

/** 행마다 시작 RP 구간의 RP 획득, 순위, TOP3 평균에서 전체 평균을 뺀 값을 붙임 */
export function bandAdjust(rows, bands) {
  const band = (m) => bands.filter((b) => m >= b).length;
  const all = { n: 0, gain: 0, rank: 0, top3: 0 };
  const by = new Map();
  for (const r of rows) {
    const b = band(r.mmr);
    if (!by.has(b)) by.set(b, { n: 0, gain: 0, rank: 0, top3: 0 });
    for (const o of [all, by.get(b)]) {
      o.n++;
      o.gain += r.gain;
      o.rank += r.rank;
      o.top3 += r.rank <= 3 ? 1 : 0;
    }
  }
  return rows.map((r) => {
    const o = by.get(band(r.mmr));
    return { ...r, bg: o.gain / o.n - all.gain / all.n, bp: o.rank / o.n - all.rank / all.n, bt: o.top3 / o.n - all.top3 / all.n };
  });
}

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
  for (const x of w) {
    W += x;
    W2 += x ** 2;
  }
  const m = {};
  for (const name of NAMES) {
    const f = METRICS[name];
    let sum = 0;
    for (let i = 0; i < rows.length; i++) sum += w[i] * (f(rows[i]) - base[name]);
    const dev = sum / W;
    let ss = 0;
    for (let i = 0; i < rows.length; i++) ss += w[i] * (f(rows[i]) - base[name] - dev) ** 2;
    m[name] = { dev, ss };
  }
  const n = rows.length;
  return {
    n,
    W,
    eff: W ** 2 / W2,
    dev: m.gain.dev,
    ss: m.gain.ss,
    m,
    raw: rows.reduce((a, r) => a + r.gain - base.gain, 0) / n,
    players: new Set(rows.map((r) => r.player)).size,
    top: Math.max(...countBy(rows, (r) => r.player).values()) / n,
    // 유효 플레이어 수: 플레이어별 판 비율 제곱합의 역수
    ep: n ** 2 / [...countBy(rows, (r) => r.player).values()].reduce((a, b) => a + b * b, 0),
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

/** 판 수 가중 평균과 표준편차 */
function spread(combos, f) {
  const N = combos.reduce((a, c) => a + c.n, 0);
  const mu = combos.reduce((a, c) => a + c.n * f(c), 0) / N;
  const sd = Math.sqrt(combos.reduce((a, c) => a + c.n * (f(c) - mu) ** 2, 0) / N) || 1;
  return { mu, sd };
}

function corr(rows, f, g) {
  const n = rows.length;
  let sf = 0, sg = 0, sff = 0, sgg = 0, sfg = 0;
  for (const r of rows) {
    const a = f(r);
    const b = g(r);
    sf += a;
    sg += b;
    sff += a * a;
    sgg += b * b;
    sfg += a * b;
  }
  const v = (sff / n - (sf / n) ** 2) * (sgg / n - (sg / n) ** 2);
  return v > 0 ? (sfg / n - (sf / n) * (sg / n)) / Math.sqrt(v) : 0;
}

/**
 * rows의 gain은 입장료 차감 전 RP(mmrGainInGame). 지표마다 실험체 점수는 0 쪽, 조합 점수는 그 실험체 점수 쪽으로 보정하고,
 * 표준화한 세 지표를 weights로 합친 뒤 RP 점수의 평균과 표준편차로 되돌림. rule.k가 있으면 지표별 추정 대신 그 값
 */
export function scoreRows(rows, rule = RULE) {
  if (!rows.length) return null;
  if (rule.bands && rows.every((r) => r.mmr != null)) rows = bandAdjust(rows, rule.bands);
  const base = Object.fromEntries(NAMES.map((name) => [name, rows.reduce((a, r) => a + METRICS[name](r), 0) / rows.length]));
  const games = new Set(rows.map((r) => r.game)).size;
  const combos = [...groupBy(rows, (r) => `${r.char}:${r.weapon}`)].map(([key, rs]) => ({
    char: rs[0].char,
    weapon: rs[0].weapon,
    key,
    ...summarize(rs, base, rule.cap),
  }));
  const chars = new Map([...groupBy(rows, (r) => r.char)].map(([c, rs]) => [c, summarize(rs, base, rule.cap)]));
  const est = {};
  const ks = {};
  for (const name of NAMES) {
    est[name] = estimateK(combos.map((c) => ({ n: c.n, W: c.W, eff: c.eff, dev: c.m[name].dev, ss: c.m[name].ss })), rule);
    ks[name] = rule.k?.[name] ?? est[name].k;
    const k = ks[name];
    for (const c of combos) {
      const ch = chars.get(c.char);
      const prior = (ch.eff * ch.m[name].dev) / (ch.eff + k);
      c.m[name].score = (c.eff * c.m[name].dev + k * prior) / (c.eff + k);
      c.m[name].post = est[name].within / (c.eff + k);
    }
  }
  const w = rule.weights;
  const scale = Object.fromEntries(NAMES.map((name) => [name, spread(combos, (c) => c.m[name].score)]));
  for (const c of combos) c.mix = NAMES.reduce((a, name) => a + (w[name] * (c.m[name].score - scale[name].mu)) / scale[name].sd, 0);
  const mix = spread(combos, (c) => c.mix);
  const rho = {};
  for (const a of NAMES) for (const b of NAMES) rho[a + b] = a === b ? 1 : corr(rows, METRICS[a], METRICS[b]);
  const rp = scale.gain;
  for (const c of combos) {
    c.z = (c.mix - mix.mu) / mix.sd;
    c.grade = grade(c.z);
    c.score = rp.mu + rp.sd * c.z;
    let v = 0;
    for (const a of NAMES)
      for (const b of NAMES) v += ((w[a] * w[b] * rho[a + b]) * Math.sqrt(c.m[a].post * c.m[b].post)) / (scale[a].sd * scale[b].sd);
    c.half = (1.645 * rp.sd * Math.sqrt(v)) / mix.sd;
    // 픽률은 경기당 등장률. 집계 경기는 참가자 전원 행이 있어 등장 수를 경기 수로 바로 나눔
    c.pick = c.n / games;
  }
  combos.sort((a, b) => b.score - a.score || b.n - a.n);
  for (const c of combos) delete c.m;
  return { base: base.gain, games, rows: rows.length, k: ks.gain, ks, within: est.gain.within, between: est.gain.between, combos };
}
