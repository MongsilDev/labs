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
  const start = 1_794_390_000_000;
  const out = derivePre([...rows(1, 3), ...rows(2, 2), ...rows(3, 6)], { ...season, start }, nm, { ids: 10, found: 3 })!;

  it("랭크와 일반을 합쳐 싣고 코발트는 뺀다", () => {
    expect(out.games).toBe(2);
    expect(out.servers).toEqual([{ name: "Asia", games: 2 }]);
    expect(out.scan).toEqual({ ids: 10, found: 3 });
  });

  it("기간은 시즌 시작부터 적는다", () => {
    expect(out.from).toBe(start);
    expect(derivePre(rows(1, 3), season, nm)!.from).toBe(1_794_400_000_001);
  });

  it("실험 과제는 팀 단위로 세고 단계 기록을 붙인다", () => {
    const quest = (slot: number) => ({ quest: slot < 6 ? "[[20001,250,1],[20002,370,4]]" : slot < 9 ? "[[10001,300,1],[10002,400,2]]" : "[]" });
    const exp = derivePre(rows(1, 3, quest), season, nm)!.exp;
    expect(exp.teams).toBe(8);
    const energy = exp.rows.find((r) => r.type === "Energy");
    expect(energy).toMatchObject({ n: 2, share: 25, rank: 1.5, win: 50, step1: 250, step2: 4 });
    expect(exp.rows.find((r) => r.type === "Material")).toMatchObject({ step1: 300, step2: 2 });
    expect(exp.none).toMatchObject({ n: 1, rank: 8, win: 0 });
  });

  it("가젯은 쓴 사람 비율과 판당 횟수만 싣는다", () => {
    const res = derivePre(rows(1, 3, (slot) => ({ gadgets: slot === 0 ? '{"8310701":3}' : slot === 1 ? '{"8310701":1}' : slot === 2 ? "[8310701]" : "{}" })), season, nm)!;
    expect(res.gadgets).toEqual([{ code: 8310701, name: "Vector 게이트", n: 3, share: 12.5, per: 2 }]);
    expect(res.noGadget).toEqual({ n: 21, share: 87.5 });
  });

  it("날씨와 지급품 이름을 찾는다", () => {
    expect(out.base).toBe(12.5);
    expect(out.weather[0]).toMatchObject({ name: "모래바람", games: 2, drop: "루미의 고글", dropShare: 50 });
  });

  it("봇은 플레이어와 팀 지표, 티어에서 뺀다", () => {
    const res = derivePre(rows(4, 3, (slot) => ({ bot: slot >= 21 ? 1 : 0 })), season, nm)!;
    expect(res).toMatchObject({ players: 21, bots: 3 });
    expect(res.exp.teams).toBe(7);
    expect(res.tier!.rows).toBe(21);
  });

  it("티어는 평균 순위와 TOP 3로 매기고 7팀 경기 순위를 보정한다", () => {
    // 실험체 1은 늘 1위 팀, 2는 늘 꼴찌 팀. 7팀 경기는 봇 팀 없이 21명
    const g = (game: number, size: number) =>
      rows(game, 3, (slot) => ({ char: slot < 3 ? 1 : slot >= (size - 1) * 3 ? 2 : 3, weapon: 1 })).slice(0, size * 3);
    const res = derivePre([...Array.from({ length: 20 }, (_, i) => g(10 + i, 8)), ...Array.from({ length: 20 }, (_, i) => g(40 + i, 7))].flat(), season, nm)!;
    const [first, , last] = res.tier!.combos;
    expect(first).toMatchObject({ char: 1, grade: "S", win: 100, top3: 100, place: 1, n: 120 });
    expect(last).toMatchObject({ char: 2, top3: 0 });
    expect(last.place).toBe(7.5);
    expect(res.tier!.thin).toBe(30);
    expect(res.tier!.combos.reduce((a, c) => a + c.pick, 0)).toBeCloseTo(100, 0);
  });

  it("실험체 줄은 표본이 모자라면 싣지 않는다", () => {
    expect(derivePre(rows(1, 3), season, nm)!.expChars).toEqual([]);
    const many = derivePre([1, 2].flatMap((g) => rows(g, 3)), season, nm)!;
    expect(many.expChars[0]).toMatchObject({ name: "나딘", weaponName: "활", n: 48 });
  });

  it("경기가 없으면 쓰지 않는다", () => {
    expect(derivePre([], season, nm)).toBeNull();
    expect(derivePre(rows(1, 6), season, nm)).toBeNull();
    const dir = mkdtempSync(join(tmpdir(), "pre-"));
    expect(writePre(dir, null)).toBe(false);
    expect(writePre(dir, out)).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "er-preseason/preseason.json"), "utf8")).games).toBe(2);
  });
});
