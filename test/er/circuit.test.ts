import { describe, expect, it } from "vitest";
import { certainty, circuitOdds, parseTable, parseTeams, problem } from "@/er/lib/circuit";

const teams = (...pts: number[]) => pts.map((points, i) => ({ name: `팀${i + 1}`, points }));

describe("서킷 진출 확률", () => {
  it("팀 줄과 순위별 포인트를 읽음", () => {
    expect(parseTeams("대전 오토암즈 120\n\n광주, 95\nGC 부산\t80")).toEqual({
      teams: [
        { name: "대전 오토암즈", points: 120 },
        { name: "광주", points: 95 },
        { name: "GC 부산", points: 80 },
      ],
      bad: [],
    });
    expect(parseTeams("포인트 없음\n팀 10").bad).toEqual([1]);
    expect(parseTable("100, 70 50\n40")).toEqual([100, 70, 50, 40]);
  });

  it("남은 대회가 0이면 현재 포인트로만 판정하고 컷 경계 동점은 반씩", () => {
    const s = { teams: teams(30, 20, 20, 10), table: [], left: 0, spots: 2 };
    expect(problem(s)).toBeNull();
    const o = circuitOdds(s, 20_000);
    expect(o.p[0]).toBe(1);
    expect(o.p[3]).toBe(0);
    expect(o.p[1]).toBeCloseTo(0.5, 1);
    expect(o.sure).toEqual([true, false, false, false]);
    expect(o.never).toEqual([false, false, false, true]);
  });

  it("남은 대회 최대 포인트로도 따라잡을 수 없으면 확정과 탈락", () => {
    const s = { teams: teams(500, 400, 100, 0), table: [100, 50, 20, 0], left: 2, spots: 2 };
    const c = certainty(s);
    expect(c.sure).toEqual([true, true, false, false]);
    expect(c.never).toEqual([false, false, true, true]);
    const o = circuitOdds(s, 5_000);
    expect(o.p).toEqual([1, 1, 0, 0]);
  });

  it("같은 포인트의 팀은 확률이 같고 합은 진출 팀 수", () => {
    const s = { teams: teams(0, 0, 0, 0, 0, 0), table: [10, 6, 4, 3, 2, 1], left: 3, spots: 2 };
    const o = circuitOdds(s);
    const sum = o.p.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(2, 6);
    for (const p of o.p) expect(p).toBeCloseTo(1 / 3, 1);
  });

  it("점수표가 팀 수보다 짧거나 진출 팀 수가 맞지 않으면 막음", () => {
    expect(problem({ teams: teams(1, 2, 3), table: [3, 2], left: 1, spots: 1 })).toContain("3위까지");
    expect(problem({ teams: teams(1, 2, 3), table: [3, 2], left: 0, spots: 1 })).toBeNull();
    expect(problem({ teams: teams(1, 2, 3), table: [3, 2, 1], left: 1, spots: 3 })).toContain("1~2팀");
    expect(problem({ teams: teams(1), table: [1], left: 1, spots: 1 })).toContain("두 팀");
    expect(problem({ teams: teams(1, 2), table: [1, NaN], left: 1, spots: 1 })).toContain("정수만");
  });
});
