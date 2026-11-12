import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePre, writePre } from "../../scripts/er/tier/preseason.mjs";

type R = Record<string, unknown>;

const nm = {
  char: (c: number) => ({ key: c === 6 ? "Nadine" : String(c), name: c === 6 ? "나딘" : String(c) }),
  weapon: (w: number) => (w === 7 ? "활" : `무기 ${w}`),
  skill: (c: number) => (Math.floor(c / 100) * 100 === 8310700 ? "Vector 게이트" : `가젯 ${c}`),
  state: (c: number) => (Math.floor(c / 100) * 100 === 8500600 ? "루미의 고글" : `버프 ${c}`),
  weather: (c: number) => (c === 10004 ? "모래바람" : `날씨 ${c}`),
};
const season = { id: 42, name: "프리 시즌 13" };

// 8팀 3인 경기. 팀 i는 i+1위
function rows(game: number, mode: number, over: (slot: number) => R = () => ({})): R[] {
  return Array.from({ length: 24 }, (_, slot) => ({
    game, slot, season: 42, t: 1_794_400_000_000 + game, mode, server: "Asia", team: Math.floor(slot / 3) + 1, rank: Math.floor(slot / 3) + 1,
    char: 6, weapon: 7, bot: 0, weather: 10004, exp: slot < 6 ? "Energy" : slot < 21 ? "Material" : null, exp_reward: 10, exp_credit: 0,
    gadgets: slot === 0 ? "[8310701]" : "[]", drops: slot < 12 ? "[[8500601,1]]" : "[]", lumi: 0,
    ...over(slot),
  }));
}

describe("프리 시즌 특집 집계", () => {
  const out = derivePre([...rows(1, 3), ...rows(2, 2), ...rows(3, 6)], season, nm, { ids: 10, found: 3 })!;

  it("랭크와 일반만 나눠 싣고 코발트는 뺀다", () => {
    expect(out.modes.map((m) => [m.id, m.games])).toEqual([["rank", 1], ["normal", 1]]);
    expect(out.scan).toEqual({ ids: 10, found: 3 });
  });

  it("실험 과제는 팀 단위로 센다", () => {
    const exp = out.modes[0].exp;
    expect(exp.teams).toBe(8);
    const energy = exp.rows.find((r) => r.type === "Energy");
    expect(energy).toMatchObject({ n: 2, share: 25, rank: 1.5, win: 50 });
    expect(exp.none).toMatchObject({ n: 1, rank: 8, win: 0 });
  });

  it("가젯, 날씨, 지급품 이름을 찾는다", () => {
    const m = out.modes[0];
    expect(m.gadgets).toEqual([expect.objectContaining({ code: 8310701, name: "Vector 게이트", n: 1, win: 100 })]);
    expect(m.noGadget).toMatchObject({ n: 23 });
    expect(m.base).toBe(12.5);
    expect(m.weather[0]).toMatchObject({ name: "모래바람", games: 1, drop: "루미의 고글", dropShare: 50 });
  });

  it("봇은 플레이어와 팀 지표에서 뺀다", () => {
    const res = derivePre(rows(4, 3, (slot) => ({ bot: slot >= 21 ? 1 : 0 })), season, nm)!;
    expect(res.modes[0]).toMatchObject({ players: 21, bots: 3 });
    expect(res.modes[0].exp.teams).toBe(7);
  });

  it("실험체 줄은 표본이 모자라면 싣지 않는다", () => {
    expect(out.modes[0].expChars).toEqual([]);
    const many = derivePre([1, 2].flatMap((g) => rows(g, 3)), season, nm)!;
    expect(many.modes[0].expChars[0]).toMatchObject({ name: "나딘", weaponName: "활", n: 48 });
  });

  it("경기가 없으면 쓰지 않는다", () => {
    expect(derivePre([], season, nm)).toBeNull();
    const dir = mkdtempSync(join(tmpdir(), "pre-"));
    expect(writePre(dir, null)).toBe(false);
    expect(writePre(dir, out)).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "er-preseason/preseason.json"), "utf8")).modes).toHaveLength(2);
  });
});
