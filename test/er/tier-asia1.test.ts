import { describe, expect, it } from "vitest";
import { buildAsia, FRESH_MS, isActive, lookupQueue, officialShort, pruneIds, RECHECK_MS, RETRY_MS, usableAsia } from "../../scripts/er/tier/asia1.mjs";
import { boardCuts } from "../../scripts/er/tier/etercut.mjs";

const row = (nickname: string, rank: number, mmr: number) => ({ nickname, rank, mmr });

describe("buildAsia", () => {
  it("아시아1과 서버를 모르는 계정만 RP순으로 다시 매긴다", () => {
    const top = [row("a", 1, 7000), row("na", 2, 6900), row("b", 3, 6800), row("c", 4, 6800.5)];
    const ids = { a: { s: 10 }, na: { s: 12 }, b: { s: 10 }, c: { s: null } };
    const r = buildAsia(top, ids);
    expect(r.unknown).toBe(1);
    expect(r.topRanks).toEqual([row("a", 1, 7000), row("b", 2, 6800), row("c", 3, 6800.5)]);
  });
});

describe("isActive", () => {
  it("공식 순위표가 비었거나 적을 때만 재구성 순위를 쓴다", () => {
    expect(isActive(23, 998)).toBe(true);
    expect(isActive(0, 998)).toBe(true);
    expect(isActive(null, 998)).toBe(true);
    expect(isActive(1001, 998)).toBe(false);
    expect(isActive(990, 998)).toBe(false);
    expect(isActive(500, 480)).toBe(false);
    expect(isActive(20, 200)).toBe(false);
    expect(isActive(23, 998, 51)).toBe(false);
  });
  it("정각 회차는 직접 받은 공식 순위표가 모자랄 때만 바꾼다", () => {
    const asia = { count: 998, topRanks: [] };
    expect(officialShort(null, asia)).toBe(true);
    expect(officialShort(new Array(23), asia)).toBe(true);
    expect(officialShort(new Array(1001), asia)).toBe(false);
  });
  it("1,000명이 안 되는 순위표의 1,000위는 마지막 RP가 문턱 아래일 때만 문턱으로 본다", () => {
    const top = (base: number) => Array.from({ length: 998 }, (_, k) => row(`p${k}`, k + 1, base - k));
    expect(boardCuts(top(7000), false)[1]).toEqual({ mmr: 8300 });
    expect(boardCuts(top(10000), false)[1]).toBeNull();
  });
});

describe("lookupQueue", () => {
  it("처음 보는 계정, 못 찾은 계정, 오래 확인 안 한 계정 순으로 고른다", () => {
    const now = 10 * RECHECK_MS;
    const top = ["old", "miss", "ok", "new", "missNow"].map((n, i) => row(n, i + 1, 7000 - i));
    const ids = {
      old: { s: 10, t: now - RECHECK_MS - 1 },
      miss: { s: null, t: now - RETRY_MS - 1 },
      ok: { s: 10, t: now - 1000 },
      missNow: { s: null, t: now - 1000 },
    };
    expect(lookupQueue(top, ids, now, 10)).toEqual(["new", "miss", "old"]);
    expect(lookupQueue(top, ids, now, 2)).toEqual(["new", "miss"]);
  });
});

describe("pruneIds", () => {
  it("순위표에서 하루 넘게 빠진 계정만 지운다", () => {
    const now = 10 * RECHECK_MS;
    const ids: Record<string, { s: number; t: number; seen?: number }> = {
      here: { s: 10, t: 0 },
      gone: { s: 10, t: 0, seen: now - RECHECK_MS - 1 },
      recent: { s: 10, t: 0, seen: now - 1000 },
    };
    pruneIds(ids, [row("here", 1, 7000)], now);
    expect(Object.keys(ids).sort()).toEqual(["here", "recent"]);
    expect(ids.here.seen).toBe(now);
  });
});

describe("usableAsia", () => {
  const data = { at: 1_000_000, season: 43, active: true, topRanks: [] };
  it("같은 시즌이고 active이며 15분 안에 쓴 값만 쓴다", () => {
    expect(usableAsia(data, 43, data.at + FRESH_MS)).toBe(data);
    expect(usableAsia(data, 43, data.at + FRESH_MS + 1)).toBeNull();
    expect(usableAsia(data, 44, data.at)).toBeNull();
    expect(usableAsia({ ...data, active: false }, 43, data.at)).toBeNull();
    expect(usableAsia(null, 43, data.at)).toBeNull();
  });
});
