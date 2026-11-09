import { describe, expect, it } from "vitest";
import { dakStopped } from "../../scripts/er/tier/dakstop.mjs";

describe("dakStopped", () => {
  const now = Date.parse("2026-11-10T03:00:00+09:00");
  it("파일이 없으면 요청한다", () => expect(dakStopped(null, now)).toBe(false));
  it("적힌 시각 전에는 멈춘다", () => expect(dakStopped("2026-11-10T12:00:00+09:00\n", now)).toBe(true));
  it("적힌 시각이 지나면 요청한다", () => expect(dakStopped("2026-11-10T02:59:59+09:00", now)).toBe(false));
  it("빈 파일이나 읽을 수 없는 내용이면 지울 때까지 멈춘다", () => {
    expect(dakStopped("", now)).toBe(true);
    expect(dakStopped("stop", now)).toBe(true);
  });
});
