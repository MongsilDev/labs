import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { csv } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-keys-"));
process.env.LABS_BOT_TOKEN = "b".repeat(64);
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const owner = { id: "31", name: "개최자", avatar: null };
const op = { id: "32", name: "운영자", avatar: null };
const stranger = { id: "33", name: "남", avatar: null };

let session: typeof owner | null = null;
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.9" }) }));
vi.mock("@/er/server/auth", async (orig) => ({
  ...(await orig<typeof import("../../src/er/server/auth")>()),
  currentUser: async () => session,
}));

let t: typeof import("../../src/er/server/tournament");
let d: typeof import("../../src/er/server/db");
let board: typeof import("../../src/er/server/board");

beforeAll(async () => {
  d = await import("../../src/er/server/db");
  t = await import("../../src/er/server/tournament");
  board = await import("../../src/er/server/board");
  for (const u of [owner, op, stranger]) d.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
});

let code = "";
let keys: string[] = [];

beforeEach(() => {
  session = null;
  d.db().exec("DELETE FROM tournaments");
  const r = t.createScrim({
    owner: owner.id,
    operators: [op.id],
    name: "스크림",
    links: [
      { group: "A", channelId: "901", guild: "서버", channel: "a" },
      { group: "B", channelId: "902", guild: "서버", channel: "b" },
    ],
  });
  if (r.status !== "ok") throw new Error(r.status);
  code = r.code;
  keys = t.visibleView(code, owner)!.keys!;
  t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "a.csv", text: csv(11, [{ team: "에이조팀", place: 1, ks: 3 }]) }] });
  t.applyOp(code, owner, { op: "add_csv", group: 1, files: [{ name: "b.csv", text: csv(12, [{ team: "비조팀", place: 1, ks: 3 }]) }] });
});

const get = async (query: string) => {
  const { GET } = await import("../../src/app/api/t/[code]/route");
  return GET(new NextRequest(`http://localhost/api/t/${code}${query}`), { params: Promise.resolve({ code }) });
};

describe("스크림 조별 키", () => {
  it("조마다 다른 키를 만들고 일반 대회에는 만들지 않음", () => {
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[0]).toMatch(/^[0-9a-f]{24}$/);
    const plain = t.createTournament(owner, { name: "일반", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 2 });
    expect(t.visibleView(plain, null)?.groups).toHaveLength(2);
    expect(t.visibleView(plain, null)?.keys).toBeUndefined();
    expect(t.groupPath(plain, 1)).toBe(`/er/t/${plain}/b`);
  });

  it("키가 없거나 틀리면 없는 대회와 같음", () => {
    for (const key of [undefined, null, "", "a", "b", keys[0].slice(1), `${keys[0]}0`]) expect(t.visibleView(code, null, key)).toBeNull();
    expect(t.visibleView(code, stranger)).toBeNull();
    expect(t.visibleVersion(code, null)).toBeNull();
  });

  it("키로 열면 그 조 하나만 보내고 다른 조 글자가 응답에 없음", () => {
    const view = t.visibleView(code, null, keys[0])!;
    expect(view.name).toBe("스크림 A조");
    expect(view.groupCount).toBe(1);
    expect(view.groups.map((g) => [g.idx, g.label])).toEqual([[0, "A"]]);
    expect(view.keys).toEqual([keys[0]]);
    expect(view.logs).toBeNull();
    const body = JSON.stringify(view);
    expect(body).toContain("에이조팀");
    expect(body).not.toContain("비조팀");
    expect(body).not.toContain(keys[1]);
  });

  it("다른 조에 기록이 들어가도 키로 본 version과 수정 시각이 그대로임", () => {
    const before = t.visibleView(code, null, keys[0])!;
    t.applyOp(code, owner, { op: "add_csv", group: 1, files: [{ name: "b2.csv", text: csv(22, [{ team: "비조팀", place: 1, ks: 3 }]) }] });
    expect(t.visibleView(code, null, keys[0])).toEqual(before);
    t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "a2.csv", text: csv(21, [{ team: "에이조팀", place: 1, ks: 3 }]) }] });
    expect(t.visibleView(code, null, keys[0])!.version).not.toBe(before.version);
  });

  it("개최자와 운영자는 키 없이 전체를 봄", () => {
    for (const user of [owner, op]) {
      const view = t.visibleView(code, user)!;
      expect(view.groups).toHaveLength(2);
      expect(view.keys).toEqual(keys);
    }
  });

  it("조회 API는 같은 판정을 거침", async () => {
    expect((await get("")).status).toBe(404);
    expect((await get("?since=1")).status).toBe(404);
    const res = await get(`?key=${keys[1]}`);
    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain("비조팀");
    expect(text).not.toContain("에이조팀");
    const { version } = JSON.parse(text) as { version: number };
    expect((await get(`?key=${keys[1]}&since=${version}`)).status).toBe(204);
    session = op;
    expect((await get("")).status).toBe(200);
  });

  it("주소의 조 자리에 키를 쓸 수 있음", async () => {
    const { groupIndex } = await import("../../src/er/lib/view");
    const full = t.visibleView(code, owner)!;
    expect(groupIndex(full, keys[1])).toBe(1);
    expect(groupIndex(full, "b")).toBe(-1);
    const plain = t.createTournament(owner, { name: "일반", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 2 });
    expect(groupIndex(t.visibleView(plain, null)!, "b")).toBe(1);
    expect(groupIndex(t.visibleView(plain, null)!, "z")).toBe(-1);
    expect(groupIndex(t.visibleView(code, null, keys[1])!, keys[1])).toBe(0);
  });

  it("봇 보드의 주소에 그 조의 키가 들어감", () => {
    const b = board.botBoard(code, "B", null);
    if (!b || b === "no-group") throw new Error("보드 없음");
    expect(b.url.endsWith(`/er/t/${code}/${keys[1]}`)).toBe(true);
    const pasted = board.botBoard(code, keys[1], owner.id);
    if (!pasted || pasted === "no-group") throw new Error("보드 없음");
    expect([pasted.group, pasted.role]).toEqual(["B", "owner"]);
    const typed = board.botBoard(code, "B", owner.id);
    if (!typed || typed === "no-group") throw new Error("보드 없음");
    expect(typed.url).toBe(pasted.url);
    expect(board.botBoard(code, "ffffffffffffffffffffffff", owner.id)).toBe("no-group");
    expect(board.botRelay("901", owner.id, "개최자", "x.txt", "").status).not.toBe("unlinked");
  });

  it("조 수를 줄였다 늘리면 키를 새로 만듦", () => {
    const empty = t.createScrim({ owner: owner.id, name: "빈 대회", links: [{ group: "A", channelId: "903" }, { group: "B", channelId: "904" }] });
    if (empty.status !== "ok") throw new Error(empty.status);
    const old = t.visibleView(empty.code, owner)!.keys!;
    t.applyOp(empty.code, owner, { op: "update_settings", groupCount: 1 });
    t.applyOp(empty.code, owner, { op: "update_settings", groupCount: 2 });
    const now = t.visibleView(empty.code, owner)!.keys!;
    expect(now[0]).toBe(old[0]);
    expect(now[1]).not.toBe(old[1]);
    expect(t.visibleView(empty.code, null, old[1])).toBeNull();
  });
});
