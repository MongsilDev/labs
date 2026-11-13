import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { derivePre, writePre } from "../../scripts/er/tier/preseason.mjs";

type R = Record<string, unknown>;

const nm = {
  char: (c: number) => ({ key: c === 6 ? "Nadine" : String(c), name: c === 6 ? "나딘" : String(c) }),
  weapon: (w: number) => (w === 7 ? "활" : `무기 ${w}`),
  state: (c: number) => (Math.floor(c / 100) * 100 === 8500600 ? "루미의 고글" : `버프 ${c}`),
  weather: (c: number) => (c === 10004 ? "모래바람" : `날씨 ${c}`),
  item: (c: number) => [c === 201538 ? "제왕의 투구" : `아이템 ${c}`, c === 201999 ? "Epic" : "Legend"] as [string, string],
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
  it("직전 시즌보다 승률이 확실히 오르거나 내린 조합만 싣는다", () => {
    // 지금은 6번 실험체가 1위 팀(3명)만 쓰고 나머지는 9번. 직전 시즌은 6번이 8위만, 9번은 고르게
    const games = (from: number, k: number, slotChar: (slot: number) => number) =>
      Array.from({ length: k }, (_, i) => rows(from + i, 3, (slot) => ({ char: slotChar(slot), weapon: 7 }))).flat();
    const now = games(100, 40, (slot) => (slot < 3 ? 6 : 9));
    const then = games(1, 40, (slot) => (slot >= 21 ? 6 : 9)).map((r) => ({ ...r, season: 41 }));
    const c = derivePre(now, season, nm, null, then)!.change!;
    expect(c.games).toBe(40);
    expect(c.up.map((x) => [x.name, x.win, x.d])).toEqual([["나딘", 100, 100]]);
    expect(c.down.map((x) => [x.name, x.win])).toEqual([["9", 0]]);
    expect(derivePre(now, season, nm)!.change).toBeNull();
  });

  it("신규 방어구는 같은 부위, 같은 등급을 낀 사람과 견준다", () => {
    // 1위 팀만 제왕의 투구, 2~4위 팀은 다른 전설 머리, 나머지는 영웅 머리. 예전 행(equip 없음)은 세지 않음
    const head = (slot: number) => (slot < 3 ? 201538 : slot < 12 ? 201501 : 201999);
    const g = derivePre([...rows(1, 3, (slot) => ({ equip: JSON.stringify([101101, 0, head(slot), 0, 0, 0]) })), ...rows(2, 3)], season, nm)!;
    expect(g.equipped).toBe(24);
    expect(g.equipGames).toBe(1);
    expect(g.armor).toEqual([{ code: 201538, name: "제왕의 투구", grade: "전설", n: 3, share: 25, rank: 1, win: 100, winCi: 0, restWin: 0, restRank: 3, rankCi: 0.53 }]);
  });

  const start = 1_794_390_000_000;
  const out = derivePre([...rows(1, 3), ...rows(2, 2), ...rows(3, 6)], { ...season, start }, nm, { ids: 10, found: 3 })!;

  it("랭크와 일반을 합쳐 싣고 코발트는 뺀다", () => {
    expect(out.games).toBe(2);
    expect(out.modes).toEqual([{ mode: 3, games: 1 }, { mode: 2, games: 1 }]);
    // 코발트 한 경기의 조합은 표본이 모자라 싣지 않음
    expect(out.cobalt).toBeNull();
    expect(out.servers).toEqual([{ name: "Asia", games: 2 }]);
    expect(out.scan).toEqual({ ids: 10, found: 3 });
  });

  it("기간은 실제로 받은 첫 경기부터 적는다", () => {
    expect(out.from).toBe(1_794_400_000_001);
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

  it("코발트는 승패만 따로 세고 픽률을 팀 수로 나눈다", () => {
    // 4인 두 팀 30경기. 1~4번 실험체 팀이 늘 이김
    const game = (id: number) => rows(id, 6, (slot) => ({ char: slot + 1, weapon: 1, team: slot < 4 ? 1 : 2, rank: slot < 4 ? 1 : 2 })).slice(0, 8);
    const c = derivePre([...rows(1, 3), ...Array.from({ length: 30 }, (_, i) => game(10 + i)).flat()], season, nm)!.cobalt!;
    expect(c).toMatchObject({ games: 30, teams: 60, base: 50 });
    expect(c.combos).toHaveLength(8);
    expect(c.combos[0]).toMatchObject({ n: 30, pick: 50, win: 100, grade: "S" });
    expect(c.combos[7]).toMatchObject({ win: 0, grade: "D" });
  });

  it("날씨와 지급품 이름을 찾는다", () => {
    expect(out.base).toBe(12.5);
    expect(out.weather[0]).toMatchObject({ name: "모래바람", games: 2, share: 100, drop: "루미의 고글", dropShare: 50 });
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
    // 등급은 순위 비율로 나눠 조합이 셋이면 첫째가 A
    expect(first).toMatchObject({ char: 1, grade: "A", win: 100, top3: 100, place: 1, n: 120 });
    expect(last).toMatchObject({ char: 2, top3: 0 });
    expect(last.place).toBe(7.5);
    expect(res.tier!.thin).toBe(30);
    // 픽률은 등장 수 / 팀 수(8팀 20경기, 7팀 20경기). 1위 팀 셋이 모두 실험체 1이라 120 / 300
    expect(res.tier!.combos.reduce((a, c) => a + c.pick, 0)).toBeCloseTo(300, 0);
    expect(first.pick).toBe(40);
  });

  it("실험체 줄은 표본이 모자라면 싣지 않는다", () => {
    expect(derivePre(rows(1, 3), season, nm)!.expChars).toEqual([]);
    const many = derivePre([1, 2].flatMap((g) => rows(g, 3)), season, nm)!;
    // 30명이 넘는 분야가 하나뿐이면 가장 좋은 분야를 고르지 않음
    expect(many.expChars[0]).toMatchObject({ name: "나딘", weaponName: "활", n: 48, best: null });
    // 에너지 공학은 1~2위 팀, 재료 공학은 3~7위 팀
    expect(derivePre([1, 2, 3, 4, 5].flatMap((g) => rows(g, 3)), season, nm)!.expChars[0]).toMatchObject({ n: 120, best: "Energy" });
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
