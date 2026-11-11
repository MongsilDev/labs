import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { topView, writeTop } from "../../scripts/er/tier/top.mjs";

const FIRST = { nickname: "Foo", rank: 1, mmr: 10318 };
const GAMES = Array.from({ length: 12 }, (_, i) => ({ t: 1_794_400_000_000 - i * 1_800_000, rank: (i % 8) + 1, gain: 40 - i * 10 }));

describe("오버레이 1위 자료", () => {
  it("랭킹 1위와 저장된 경기로 오버레이 값을 만든다", () => {
    expect(topView(FIRST, GAMES, 8300, 1_794_400_500_000)).toEqual({
      nickname: "Foo", tier: "이터니티", mmr: 10318, place: "아시아1 1위", serverRank: 1, serverCode: 10,
      last: { gain: 40, at: 1_794_400_000 }, recent: [1, 2, 3, 4, 5, 6, 7, 8, 1, 2], updatedAt: 1_794_400_500,
    });
  });

  it("저장된 경기가 없어도 순위와 RP는 만든다", () => {
    expect(topView(FIRST, [], 8300, 1000)).toMatchObject({ nickname: "Foo", last: null, recent: [] });
  });

  it("1위가 이터니티 기준에 못 미치거나 닉네임이 없으면 null을 쓴다", () => {
    expect(topView({ ...FIRST, mmr: 8299 }, GAMES, 8300, 1000)).toBeNull();
    expect(topView({ rank: 1, mmr: 10318 }, GAMES, 8300, 1000)).toBeNull();
    expect(topView(undefined, [], 8300, 1000)).toBeNull();
    const dir = mkdtempSync(join(tmpdir(), "top-"));
    writeTop(dir, topView(FIRST, GAMES, 8300, 1000));
    writeTop(dir, null);
    expect(readFileSync(join(dir, "er-rank/top.json"), "utf8")).toBe("null");
  });
});
