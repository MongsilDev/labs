import { afterEach, describe, expect, it, vi } from "vitest";
import { between, type CutData, type CutTier, chance, chanceLabel, daysLeft, graceKey, quitRp } from "../../src/er/lib/cut";
import { ticks } from "../../src/er/lib/ticks";
import { getCut } from "../../src/er/server/cut";

afterEach(() => vi.unstubAllGlobals());

describe("이터컷 계산", () => {
  it("사이 인원은 양 끝을 빼고 세고, 순위표 밖이면 모른다", () => {
    const rps = [9300, 9200, 9100, 9100, 9000, 8900];
    expect(between(rps, 9000, 9200)).toBe(2);
    expect(between(rps, 9250, 9050)).toBe(3);
    expect(between(rps, 8800, 9000)).toBeNull();
  });

  it("가능성은 가운데 값에서 반반, 낮은 값과 높은 값에서 10%와 90%", () => {
    expect(chance(9380, 9380, 9200, 9480)).toBeCloseTo(0.5, 2);
    expect(chance(9200, 9380, 9200, 9480)).toBeCloseTo(0.1, 2);
    expect(chance(9480, 9380, 9200, 9480)).toBeCloseTo(0.9, 2);
    expect(chanceLabel(0.5)).toBe("중간");
    expect(chanceLabel(0.95)).toBe("높음");
  });

  it("쉬면 깎인 RP는 메테오라이트 4 아래로 내려가지 않는다", () => {
    expect(quitRp(9050, 8, 100, 6400)).toBe(8250);
    expect(quitRp(6600, 8, 100, 6400)).toBe(6400);
    expect(quitRp(6000, 8, 100, 6400)).toBe(6000);
  });

  it("유예 티어는 순위표에서 내 RP가 들어갈 순위로 정한다", () => {
    const data = { rps: [9300, 9200, 9100, 9000], tiers: { eternity: { place: 1 }, demigod: { place: 3 } } } as CutData;
    expect(graceKey(data, 9300)).toBe("eternity");
    expect(graceKey(data, 9250)).toBe("demigod");
    expect(graceKey(data, 9100)).toBe("demigod");
    expect(graceKey(data, 9050)).toBe("default");
  });

  it("남은 날은 KST 날짜 차이", () => {
    const end = Date.parse("2026-11-12T09:00:00+09:00");
    expect(daysLeft(end, Date.parse("2026-10-20T00:30:00+09:00"))).toBe(23);
    expect(daysLeft(end, Date.parse("2026-11-12T08:00:00+09:00"))).toBe(0);
  });
});

describe("봇 응답 값의 범위", () => {
  it("눈금은 값이 크고 폭이 좁아도 정해진 개수 안에서 끝난다", () => {
    const cases = [[7000, 7400], [1e17, 1e17 + 16], [3e17, 3e17 + 64], [1e20, 1e20 + 65536], [1e20, 1e20], [-1e308, 1e308], [0, Infinity], [NaN, 1]];
    for (const [lo, hi] of cases) expect(ticks(lo, hi, 5).length).toBeLessThanOrEqual(7);
  });

  it("받은 시각에서 1년 넘게 떨어진 날짜나 앞으로의 받은 시각이 든 봇 응답은 쓰지 않는다", async () => {
    const at = 1_792_000_000;
    const tier = (decay: [string, number][]): CutTier => ({
      place: 1,
      board: 9000,
      cut: 9000,
      estimated: false,
      dropped: null,
      history: [[at - 86_400, 9000, 9000]],
      forecast: [[at + 86_400, 9000, 8900, 9100, 0]],
      decay,
      decayStay: 0,
    });
    const reply = (decay: [string, number][], over: Partial<CutData> = {}) => {
      const data: CutData = { updatedAt: at, season: { id: 1, name: "시즌", end: null }, rps: [9000], tiers: { eternity: tier(decay), demigod: tier([]) }, quitTicks: null, rule: { grace: { eternity: 0, demigod: 0, default: 0 }, graceFrom: 0, step: 0, floor: 0, dormantDays: 0 }, ...over };
      vi.stubGlobal("fetch", async () => Response.json(data));
    };
    reply([["9999-12-31", 1]]);
    expect(await getCut()).toBeNull();
    reply([], { season: { id: 1, name: "시즌", end: 1e15 } });
    expect(await getCut()).toBeNull();
    reply([], { updatedAt: Date.now() / 1000 + 7 * 86_400 });
    expect(await getCut()).toBeNull();
    reply([["2026-10-25", 1]]);
    expect((await getCut())?.tiers.eternity.decay).toEqual([["2026-10-25", 1]]);
  });
});
