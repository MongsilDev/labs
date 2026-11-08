import { afterEach, describe, expect, it, vi } from "vitest";
import { rankBadge } from "@/er/lib/rank";
import { NICKNAME, parseRank, rankOf } from "@/er/server/rank";

const VIEW = { nickname: "Foo", tier: "메테오라이트 3", mmr: 6842, place: "아시아1 1,284위", serverRank: 1284, serverCode: 10, last: { gain: 38, at: 1794150000 }, updatedAt: 1794150100 };

describe("티어 방송 화면", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("티어 이름을 약자와 색으로 바꿈", () => {
    expect(rankBadge("메테오라이트 3").short).toBe("M3");
    expect(rankBadge("데미갓").short).toBe("DG");
    expect(rankBadge("언랭크").short).toBe("-");
  });

  it("닉네임 형식", () => {
    expect(NICKNAME.test("몽실")).toBe(true);
    expect(NICKNAME.test("a b")).toBe(false);
    expect(NICKNAME.test("x")).toBe(false);
  });

  it("봇 응답의 모양이 다르면 버림", () => {
    expect(parseRank(VIEW)?.mmr).toBe(6842);
    expect(parseRank({ ...VIEW, mmr: "6842" })).toBeNull();
    expect(parseRank({ ...VIEW, last: null })?.last).toBeNull();
    expect(parseRank({ ...VIEW, tier: "골드\u0000 1" })?.tier).toBe("골드 1");
  });

  it("같은 닉네임은 한 번만 부르고, 실패하면 마지막 값을 씀", async () => {
    vi.stubEnv("BOT_API_URL", "http://bot.test");
    const fetch = vi.fn(async () => new Response(JSON.stringify(VIEW), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const [a, b] = await Promise.all([rankOf("CacheA"), rankOf("cachea")]);
    expect(a.ok && b.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    fetch.mockImplementation(async () => new Response("", { status: 503 }));
    const c = await rankOf("CacheA");
    vi.useRealTimers();
    expect(c.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("없는 닉네임은 404로 기억", async () => {
    vi.stubEnv("BOT_API_URL", "http://bot.test");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ error: "not_found" }), { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    expect(await rankOf("NobodyHere")).toEqual({ ok: false, status: 404 });
    expect(await rankOf("NobodyHere")).toEqual({ ok: false, status: 404 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
