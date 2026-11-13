import { describe, expect, it } from "vitest";
import { renameSteps } from "../../scripts/er/tier/renames.mjs";

describe("renameSteps", () => {
  it("이름이 같으면 기록하지 않는다", () => {
    expect(renameSteps([{ nickname: "B", t: 3 }, { nickname: "B", t: 2 }]).steps).toEqual([]);
  });
  it("바뀐 지점의 예전 이름 마지막 판과 새 이름 첫 판 시각을 남긴다", () => {
    const games = [{ nickname: "B", t: 9 }, { nickname: "B", t: 7 }, { nickname: "A", t: 5 }, { nickname: "A", t: 2 }];
    expect(renameSteps(games).steps).toEqual([{ old: "A", new: "B", oldLast: 5, newFirst: 7 }]);
  });
  it("두 번 바꾸면 두 단계를 따로 남긴다", () => {
    const games = [{ nickname: "C", t: 9 }, { nickname: "B", t: 6 }, { nickname: "A", t: 3 }];
    expect(renameSteps(games).steps).toEqual([
      { old: "B", new: "C", oldLast: 6, newFirst: 9 },
      { old: "A", new: "B", oldLast: 3, newFirst: 6 },
    ]);
  });
  it("쪽 경계에서 바뀐 것도 앞 쪽 마지막 판과 이어 찾는다", () => {
    const first = renameSteps([{ nickname: "B", t: 9 }, { nickname: "B", t: 8 }]);
    expect(first.steps).toEqual([]);
    expect(renameSteps([{ nickname: "A", t: 4 }], first.last).steps).toEqual([{ old: "A", new: "B", oldLast: 4, newFirst: 8 }]);
  });
  it("닉네임이 빈 판은 건너뛴다", () => {
    const games = [{ nickname: "B", t: 9 }, { nickname: null, t: 7 }, { nickname: "A", t: 5 }];
    expect(renameSteps(games).steps).toEqual([{ old: "A", new: "B", oldLast: 5, newFirst: 9 }]);
  });
});
