import { describe, expect, it } from "vitest";
import { bandAdjust, estimateK, grade, GRADES, playerWeights, RULE, scoreRows } from "../../scripts/er/tier/score.mjs";
import { TIER_BOUNDS } from "@/er/lib/tier";

type Row = { game: number; player: string; char: number; weapon: number; rank: number; gain: number };

function rows(char: number, weapon: number, gains: number[], player = (i: number) => `p${char}-${i}`): Row[] {
  return gains.map((gain, i) => ({ game: char * 10_000 + i, player: player(i), char, weapon, rank: gain > 60 ? 2 : 6, gain }));
}

describe("실험체 티어 산식", () => {
  it("등급 경계", () => {
    expect([1, 0.3, 0.29, -0.3, -0.31, -1, -1.01].map(grade)).toEqual(["S", "A", "B", "B", "C", "C", "D"]);
    expect(TIER_BOUNDS).toEqual(GRADES);
  });

  it("한 사람 몫은 표본의 20%까지만", () => {
    const rs = [...rows(1, 1, Array(8).fill(50), () => "solo"), ...rows(1, 1, [50, 50])];
    const w = playerWeights(rs, RULE.cap);
    expect(w.slice(0, 8).reduce((a, b) => a + b, 0)).toBeCloseTo(2);
    expect(w.slice(8)).toEqual([1, 1]);
  });

  it("판 수가 적은 조합은 실험체 점수 쪽으로 당겨짐", () => {
    const big = rows(1, 1, Array.from({ length: 400 }, (_, i) => 60 + (i % 2 ? 20 : -20)));
    const small = rows(1, 2, [160, 160, 160], (i) => `q${i}`);
    const other = rows(2, 1, Array.from({ length: 400 }, (_, i) => 40 + (i % 2 ? 20 : -20)));
    const r = scoreRows([...big, ...small, ...other])!;
    const s = r.combos.find((c) => c.key === "1:2")!;
    expect(s.raw).toBeGreaterThan(90);
    expect(s.score).toBeLessThan(s.raw / 3);
    expect(r.combos[0].key).toBe("1:1");
    // 픽률은 참가자 비율 × 24로 추정한 경기당 등장률
    expect(s.pick).toBeCloseTo((3 / 803) * 24);
  });

  it("조합 사이 차이가 잡음보다 작으면 k는 상한", () => {
    const g = [0, 1, 2, 3].map((i) => ({ n: 100, W: 100, eff: 100, dev: i % 2 ? 0.1 : -0.1, ss: 100 * 2500 }));
    expect(estimateK(g).k).toBe(RULE.kMax);
  });

  it("RP가 같으면 평균 순위와 TOP3가 좋은 조합이 위", () => {
    const at = (char: number, ranks: number[]) => ranks.map((rank, i) => ({ game: char * 10_000 + i, player: `p${char}-${i}`, char, weapon: 1, rank, gain: 60 + (i % 2 ? 30 : -30) }));
    const good = at(1, Array.from({ length: 300 }, (_, i) => 1 + (i % 4)));
    const bad = at(2, Array.from({ length: 300 }, (_, i) => 5 + (i % 4)));
    const r = scoreRows([...good, ...bad])!;
    expect(r.combos[0].key).toBe("1:1");
    expect(r.combos[0].raw).toBeCloseTo(r.combos[1].raw);
  });

  it("판 수가 많을수록 90% 범위가 좁고, 기간 표는 넘겨받은 k를 씀", () => {
    const many = rows(1, 1, Array.from({ length: 900 }, (_, i) => 60 + (i % 3) * 20 - 20));
    const few = rows(2, 1, Array.from({ length: 60 }, (_, i) => 60 + (i % 3) * 20 - 20));
    const r = scoreRows([...many, ...few], { ...RULE, k: { gain: 123, place: 45, top3: 67 } })!;
    const by = new Map(r.combos.map((c) => [c.key, c]));
    expect(by.get("1:1")!.half).toBeLessThan(by.get("2:1")!.half);
    expect(r.ks).toEqual({ gain: 123, place: 45, top3: 67 });
  });

  it("시작 RP 구간 평균을 빼면 구간마다 평균이 전체 평균과 같음", () => {
    const rs = [
      ...Array.from({ length: 40 }, (_, i) => ({ mmr: 6500, gain: 80 + (i % 2), rank: 2 })),
      ...Array.from({ length: 60 }, (_, i) => ({ mmr: 9500, gain: 20 + (i % 2), rank: 6 })),
    ];
    const out = bandAdjust(rs, RULE.bands!);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const all = mean(rs.map((r) => r.gain));
    expect(mean(out.slice(0, 40).map((r) => r.gain - r.bg))).toBeCloseTo(all);
    expect(mean(out.slice(40).map((r) => r.gain - r.bg))).toBeCloseTo(all);
    expect(mean(out.map((r) => r.bg))).toBeCloseTo(0);
  });

  it("시작 RP가 낮은 참가자가 많은 조합이 그것만으로 위에 오지 않음", () => {
    const at = (char: number, mmr: number, gain: number, rank: number) =>
      Array.from({ length: 300 }, (_, i) => ({ game: char * 10_000 + i, player: `p${char}-${i}`, char, weapon: 1, rank, gain: gain + (i % 2 ? 10 : -10), mmr }));
    const low = at(1, 6500, 80, 3);
    const high = at(2, 9500, 20, 6);
    const plain = scoreRows([...low, ...high], { ...RULE, bands: undefined })!;
    expect(plain.combos[0].score - plain.combos[1].score).toBeGreaterThan(10);
    const r = scoreRows([...low, ...high])!;
    expect(Math.abs(r.combos[0].score - r.combos[1].score)).toBeLessThan(0.5);
    expect(r.base).toBeCloseTo(plain.base);
  });

  it("유효 플레이어는 판 비율 제곱합의 역수", () => {
    const even = rows(1, 1, Array(40).fill(50), (i) => `a${i % 4}`);
    const lean = rows(2, 1, Array(40).fill(50), (i) => (i < 31 ? "solo" : `b${i}`));
    const r = scoreRows([...even, ...lean])!;
    const by = new Map(r.combos.map((c) => [c.key, c]));
    expect(by.get("1:1")!.ep).toBeCloseTo(4);
    expect(by.get("2:1")!.ep).toBeCloseTo(1600 / (31 ** 2 + 9));
  });

  it("빈 입력은 null", () => {
    expect(scoreRows([])).toBeNull();
  });
});
