import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { csv } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-live-"));
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const owner = { id: "41", name: "개최자", avatar: null };
const stranger = { id: "43", name: "남", avatar: null };

let session: typeof owner | null = null;
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.19", "sec-fetch-site": "same-origin" }) }));
vi.mock("@/er/server/auth", async (orig) => ({
  ...(await orig<typeof import("../../src/er/server/auth")>()),
  currentUser: async () => session,
}));

let t: typeof import("../../src/er/server/tournament");
let route: typeof import("../../src/app/api/live/[code]/[group]/route");

beforeAll(async () => {
  const d = await import("../../src/er/server/db");
  t = await import("../../src/er/server/tournament");
  route = await import("../../src/app/api/live/[code]/[group]/route");
  for (const u of [owner, stranger]) d.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
});

let code = "";
beforeEach(() => {
  session = null;
  code = t.createTournament(owner, { name: "내전", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 2 });
  t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "a.csv", text: csv(31, [{ team: "몽실", place: 1, ks: 3 }]) }] });
});

const frame = (roundNo: number) => ({ roundNo, teams: [{ slot: 1, teamId: null, name: "몽실", ts: 3, ks: 2, out: false, place: null, fixed: false }] });
const post = (group: string, body: unknown, c = code) =>
  route.POST(new Request(`http://localhost:3000/api/live/${c}/${group}`, { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ code: c, group }) });
const get = (group: string, c = code) => route.GET(new Request(`http://localhost:3000/api/live/${c}/${group}`), { params: Promise.resolve({ code: c, group }) });

describe("경기 중 값 API", () => {
  it("개최자와 운영자만 보낼 수 있고, 누구나 그 조의 값을 받음", async () => {
    expect((await post("a", frame(2))).status).toBe(401);
    session = stranger;
    expect((await post("a", frame(2))).status).toBe(404);
    session = owner;
    expect((await post("a", frame(2))).status).toBe(200);
    session = null;
    const body = (await (await get("a")).json()) as { frame: { roundNo: number; teams: { name: string }[] } };
    expect(body.frame.roundNo).toBe(2);
    expect(body.frame.teams[0].name).toBe("몽실");
    expect(((await (await get("b")).json()) as { frame: unknown }).frame).toBeNull();
  });

  it("결과가 이미 올라온 라운드와 없는 조는 받지 않음", async () => {
    session = owner;
    expect((await post("a", frame(1))).status).toBe(409);
    expect((await post("c", frame(2))).status).toBe(404);
    expect((await post("a", { roundNo: 2, teams: "x" })).status).toBe(400);
    expect((await get("c")).status).toBe(404);
    expect((await get("a", "ZZZZZZ")).status).toBe(404);
  });

  it("조마다 초당 2회까지 받음", async () => {
    session = owner;
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await post("a", frame(2))).status);
    expect(statuses).toEqual([200, 200, 429]);
    expect((await post("b", frame(1))).status).toBe(200);
  });

  it("스크림 대회는 조 키로만 받음", async () => {
    const r = t.createScrim({ owner: owner.id, operators: [], name: "스크림", links: [{ group: "A", channelId: "911", guild: "서버", channel: "a" }] });
    if (r.status !== "ok") throw new Error(r.status);
    const key = t.visibleView(r.code, owner)!.keys![0];
    session = owner;
    expect((await post(key, frame(1), r.code)).status).toBe(200);
    session = null;
    expect((await get("a", r.code)).status).toBe(404);
    expect(((await (await get(key, r.code)).json()) as { frame: { roundNo: number } }).frame.roundNo).toBe(1);
  });
});
