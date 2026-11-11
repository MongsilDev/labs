import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sortCombos, type TierCombo, type TierData } from "@/er/lib/tier";

const combo = (name: string, grade: TierCombo["grade"], score: number, z: number, n: number) => ({ name, grade, score, z, n }) as TierCombo;
const score = (c: TierCombo) => c.score;
const RANK = ["S", "A", "B", "C", "D"];
// 같은 등급이 한 덩어리로만 나오는지
const runs = (list: TierCombo[]) => list.map((c) => c.grade).filter((g, i, a) => g !== a[i - 1]);

describe("실험체 티어 표 정렬", () => {
  // 12.7 패치 보기에서 얀 글러브(B)가 판 수가 많아 A 둘 사이에 끼던 경우
  const tied = [combo("얀 글러브", "B", 0.6, 0.29, 900), combo("혜진 암기", "A", 0.6, 0.34, 300), combo("자히르 암기", "A", 0.6, 0.34, 500), combo("위", "A", 0.7, 0.4, 100), combo("아래", "B", 0.5, 0.2, 100)];

  it("점수가 같으면 등급, z, 판 수 순", () => {
    expect(sortCombos(tied, score, "desc", true).map((c) => c.name)).toEqual(["위", "자히르 암기", "혜진 암기", "얀 글러브", "아래"]);
    expect(sortCombos(tied, score, "asc", true).map((c) => c.name)).toEqual(["아래", "얀 글러브", "자히르 암기", "혜진 암기", "위"]);
  });

  it("z까지 같아도 등급이 섞이지 않음", () => {
    const edge = [combo("b", "B", 0.5, 0.3, 900), combo("a", "A", 0.5, 0.3, 100)];
    expect(sortCombos(edge, score, "desc", true).map((c) => c.name)).toEqual(["a", "b"]);
    expect(sortCombos(edge, score, "asc", true).map((c) => c.name)).toEqual(["b", "a"]);
  });

  it("다른 열은 동점이면 판 수가 많은 쪽이 먼저", () => {
    expect(sortCombos(tied.slice(0, 3), () => 1, "desc", false).map((c) => c.n)).toEqual([900, 500, 300]);
  });

  it("모든 보기에서 점수순이면 등급이 한 방향으로만 바뀜", () => {
    const data = JSON.parse(readFileSync(new URL("./fixtures/tier.json", import.meta.url), "utf8")) as TierData;
    for (const v of data.views) {
      const desc = runs(sortCombos(v.combos, score, "desc", true));
      expect(desc, v.id).toEqual(RANK.filter((g) => desc.includes(g as TierCombo["grade"])));
      const asc = runs(sortCombos(v.combos, score, "asc", true));
      expect(asc, v.id).toEqual([...desc].reverse());
    }
  });
});
