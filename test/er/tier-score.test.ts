import { describe, expect, it } from "vitest";
import { estimateK, grade, GRADES, playerWeights, RULE, scoreRows } from "../../scripts/er/tier/score.mjs";
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
  });

  it("조합 사이 차이가 잡음보다 작으면 k는 상한", () => {
    const g = [0, 1, 2, 3].map((i) => ({ n: 100, W: 100, eff: 100, dev: i % 2 ? 0.1 : -0.1, ss: 100 * 2500 }));
    expect(estimateK(g).k).toBe(RULE.kMax);
  });

  it("빈 입력은 null", () => {
    expect(scoreRows([])).toBeNull();
  });
});
