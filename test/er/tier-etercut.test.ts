import { describe, expect, it } from "vitest";
import * as E from "../../scripts/er/tier/etercut.mjs";

// 몽실봇 tests/test_decay.py, test_rank_order.py, test_season_change.py를 옮김
const kst = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h - 9, min) / 1000;
const at = (day: number, hour: number, minute = 0) => kst(2026, 11, day, hour, minute);

describe("decayTicks", () => {
  const until = at(20, 16);
  it("5시 뒤 게임은 그날 몫으로 센다", () => {
    const before = E.decayTicks(at(2, 4, 59), until);
    const after = E.decayTicks(at(2, 6), until);
    expect(before - after).toBe(1);
    expect(after).toBe(E.decayTicks(at(3, 4, 59), until));
  });
  it("5시부터 9시까지는 그날 나머지와 같다", () => {
    expect(E.decayTicks(at(2, 6), until)).toBe(E.decayTicks(at(2, 23), until));
    expect(E.decayTicks(at(2, 5), until)).toBe(E.decayTicks(at(2, 8, 59), until));
  });
  it("11-12 패치 날을 빼고 유예 12를 쓴 나머지를 센다", () => {
    expect(E.decayTicks(at(2, 4, 59), until)).toBe(5);
  });
});

describe("forecast 막판 급등", () => {
  const end = kst(2026, 11, 12, 9);
  const flat: [number, number][] = Array.from({ length: 30 }, (_, i) => [kst(2026, 10, i + 1, 9), 9000]);
  const run = (now: number) => E.forecast(flat, 9000, now, end, [200, 100, 300])!.future;
  it("지금 뒤에 남은 급등분만 더한다", () => {
    const now = kst(2026, 11, 9, 21);
    const done = E.surgeShare(2.5);
    const future = run(now);
    expect(future[0][1]).toBeCloseTo(9000 + (E.surgeShare(2) - done) * 200, 6);
    expect(future.at(-1)![1]).toBeCloseTo(9000 + (1 - done) * 200, 6);
  });
  it("종료까지 멀면 급등분을 모두 더한다", () => {
    expect(run(kst(2026, 10, 20, 9)).at(-1)![1]).toBeCloseTo(9200, 6);
  });
});

describe("순위 순서", () => {
  const rows = () => {
    const top = Array.from({ length: 1000 }, (_, k) => ({ nickname: `p${k + 1}`, rank: k + 1, mmr: 10000 - (k + 1) }));
    top.push({ nickname: "late", rank: 1001, mmr: 9914 });
    return top;
  };
  it("휴면 컷은 1001위에 늦게 붙은 계정을 무시한다", () => {
    const now = at(18, 12);
    const list: Record<string, unknown[]> = {};
    for (const r of rows()) {
      const dormant = r.mmr < 9500 && r.mmr % 2;
      list[r.nickname] = dormant ? [r.mmr, 0, 0, 0, now - 60 * 86400, now, null] : [r.mmr, now, 0, now, null, null, null];
    }
    const state = { ranks: [], cuts: [], players: { season: 41, at: now, since: 1, v: 2, list } };
    const [value, , estimated] = E.activeCut(state, 41, rows(), 1000, now + 30 * 86400, now)!;
    expect(estimated).toBe(true);
    expect(value).toBeLessThanOrEqual(9000);
  });
  it("순위표가 place까지 차지 않아도 마지막 RP가 문턱 아래면 컷은 문턱으로 정해진다", () => {
    const now = at(18, 12);
    const top = Array.from({ length: 998 }, (_, k) => ({ nickname: `p${k + 1}`, rank: k + 1, mmr: 7000 - k }));
    const list = Object.fromEntries(top.map((r) => [r.nickname, [r.mmr, now, 0, now, null, null, null]]));
    const state = { ranks: [], cuts: [], players: { season: 41, at: now, since: 1, v: 2, list } };
    expect(E.activeCut(state, 41, top, 1000, now + 30 * 86400, now)).toEqual([8300, 0, false]);
    top.forEach((r) => (r.mmr += 3000));
    expect(E.activeCut(state, 41, top, 1000, now + 30 * 86400, now)![2]).toBe(true);
  });
  it("순위표 컷은 RP 순서로 읽는다", () => {
    const top = rows();
    [top[999], top[1000]] = [{ ...top[1000], rank: 1000 }, { ...top[999], rank: 1001 }];
    const [r300, r1000] = E.boardCuts(top, false) as { mmr: number; rank: number }[];
    expect([r300.mmr, r1000.mmr, r1000.rank]).toEqual([9701, 9001, 999]);
  });
});

describe("시즌 전환", () => {
  const S41 = { seasonID: 41, seasonName: "Season21", seasonStart: "2026-08-13 12:00:00", seasonEnd: "2026-11-12 09:00:00" };
  const PRE40 = { seasonID: 40, seasonName: "Pre-Season21", seasonStart: "2026-08-06 12:00:00", seasonEnd: "2026-08-13 12:00:00", isCurrent: 0 };
  const PRE = { seasonID: 42, seasonName: "Pre-Season22", seasonStart: "2026-11-12 12:00:00", seasonEnd: "2026-11-19 12:00:00", isCurrent: 1 };
  const S43 = { seasonID: 43, seasonName: "Season22", seasonStart: "2026-11-19 12:00:00", seasonEnd: "2027-02-18 09:00:00", isCurrent: 0 };
  const now = at(12, 10);
  it("끝났지만 아직 현재인 정규 시즌은 그 종료 시각을 쓴다", () => {
    expect(E.rankedSeason([PRE40, { ...S41, isCurrent: 1 }], now)).toMatchObject({ id: 41, name: "정규 시즌 12", end: kst(2026, 11, 12, 9) });
  });
  it("현재 행이 없으면 가장 높은 번호를 쓴다", () => {
    expect(E.rankedSeason([PRE40, { ...S41, isCurrent: 0 }], now)?.id).toBe(41);
  });
  it("종료가 빈 프리 시즌이면 직전 정규 시즌을 종료 시각 없이 쓴다", () => {
    const r = E.rankedSeason([PRE40, { ...S41, isCurrent: 0 }, { ...PRE, seasonEnd: "" }], at(13, 10));
    expect(r).toMatchObject({ id: 41, name: "정규 시즌 12", end: null });
  });
  it("프리 시즌 행이 아직 현재가 아니면 정규 시즌을 쓴다", () => {
    expect(E.rankedSeason([PRE40, { ...S41, isCurrent: 1 }, { ...PRE, isCurrent: 0 }], now)?.id).toBe(41);
  });
  it("프리 시즌 동안은 시즌 41에 종료 시각이 없다", () => {
    expect(E.rankedSeason([PRE40, { ...S41, isCurrent: 0 }, PRE], at(15, 10))).toMatchObject({ id: 41, end: null });
  });
  const list = [PRE40, { ...S41, isCurrent: 0 }, PRE, S43];
  it("11:59에는 아직 시즌 41이다", () => {
    expect(E.rankedSeason(list, at(19, 11, 59))?.id).toBe(41);
  });
  it("12:00에 isCurrent가 늦어도 시즌 43으로 넘어간다", () => {
    expect(E.rankedSeason(list, at(19, 12))).toEqual({ id: 43, name: "정규 시즌 13", end: kst(2027, 2, 18, 9), fresh: true });
  });
  it("사흘이 지나면 새 시즌이 아니다", () => {
    expect(E.rankedSeason(list, at(22, 12))?.fresh).toBe(false);
  });
  it("시즌 첫날 빈 순위표는 문턱 컷을 쓴다", () => {
    const now = at(19, 12, 30);
    const end = kst(2027, 2, 18, 9);
    const state = { ranks: [], cuts: [], players: {} };
    const tiers = E.tierCuts(state, 43, [], [], end, E.cutRp(E.boardCuts([], true)[0]), E.cutRp(E.boardCuts([], true)[1]), now);
    expect(tiers.map((t) => t.start)).toEqual([8300, 8300]);
    expect(E.decaySchedule(state, 43, [], 8300, end, now)[0]).toEqual([]);
  });
  it("시즌이 끝난 뒤에는 휴면 차감을 더하지 않는다", () => {
    const end = kst(2026, 11, 12, 9);
    const p = [9000, 0, 0, 0, at(1, 12), at(1, 12), null];
    for (const day of [13, 14, 20]) expect(E.projectedRp(p, 9000, at(day, 16), end)!).toBeLessThanOrEqual(9000);
  });
});
