import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Board } from "../../src/er/server/board";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-round-image-"));
const TOKEN = "b".repeat(64);
afterAll(() => {
  vi.unstubAllGlobals();
  delete process.env.LABS_BOT_TOKEN;
  rmSync(process.env.DATA_DIR!, { recursive: true, force: true });
});

let calls: string[] = [];
beforeEach(() => {
  process.env.LABS_BOT_TOKEN = TOKEN;
  calls = [];
  const real = globalThis.fetch;
  // wasm은 data: 주소로 불러오므로 그대로 두고, 바깥 주소 요청만 셈
  vi.stubGlobal("fetch", async (url: string) => {
    if (String(url).startsWith("data:")) return real(url);
    calls.push(String(url));
    return new Response("", { status: 404 });
  });
});

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = async (r: Response) => [...new Uint8Array(await r.arrayBuffer()).slice(0, 8)];

const get = async (code: string, q: string, token: string | null = TOKEN) => {
  const { GET } = await import("../../src/app/api/bot/t/[code]/image/route");
  const headers = token ? { "x-bot-token": token } : undefined;
  return GET(new NextRequest(`http://localhost/api/bot/t/${code}/image${q}`, { headers }), { params: Promise.resolve({ code }) });
};

const example = async (): Promise<Board> => {
  const { botBoard } = await import("../../src/er/server/board");
  const b = botBoard("example", null, null);
  if (!b || b === "no-group") throw new Error("예시 없음");
  return b;
};

describe("몽실봇 라운드 이미지 API", () => {
  it("토큰이 없거나 틀리면 본문 없는 404", async () => {
    for (const token of [null, "c".repeat(64)]) {
      const r = await get("example", "?group=A", token);
      expect(r.status).toBe(404);
      expect(await r.text()).toBe("");
    }
  });

  it("없는 조는 400, 없는 대회는 404", async () => {
    const r = await get("example", "?group=B");
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "없는 조입니다." });
    expect((await get("ZZZZZZ", "?group=A")).status).toBe(404);
  });

  it("정상 요청은 캐시하지 않는 PNG를 외부 요청 없이 준다", async () => {
    const r = await get("example", "?group=a");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await png(r)).toEqual(PNG);
    expect(calls).toEqual([]);
  });
});

describe("라운드 이미지 렌더", () => {
  it("팀이 11개 이상인 순위와 결과가 없는 순위도 그린다", async () => {
    const { roundImage } = await import("../../src/er/server/round-og");
    const b = await example();
    const many = Array.from({ length: 14 }, (_, i) => ({ ...b.standings[i % b.standings.length], rank: i + 1, name: `팀 ${i + 1}` }));
    const boards: Board[] = [
      { ...b, mode: "points", ended: false, advance: 8, played: 3, standings: many },
      { ...b, ended: false, played: 0, standings: [], next: null },
    ];
    for (const board of boards) expect(await png(await roundImage(board))).toEqual(PNG);
    expect(calls).toEqual([]);
  });
});
