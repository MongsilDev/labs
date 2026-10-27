import { describe, expect, it } from "vitest";
import { num } from "../../src/er/lib/format";

describe("순위표 점수 표기", () => {
  it("정수는 소수점 없이, 아니면 소수 첫째 자리까지 쓴다", () => {
    expect([51, 0, -3, 51.0].map(num)).toEqual(["51", "0", "-3", "51"]);
    expect([33.5, 0.5, -1.5, 12.25, 7.04].map(num)).toEqual(["33.5", "0.5", "-1.5", "12.3", "7"]);
  });

  it("반올림해 정수가 되면 소수점을 붙이지 않는다", () => {
    expect([2.96, 9.95, 0.04].map(num)).toEqual(["3", "10", "0"]);
  });
});
