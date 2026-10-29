import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-scrim-"));
process.env.LABS_BOT_TOKEN = "b".repeat(64);
process.env.LABS_SCRIM_TOKEN = "s".repeat(64);
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const SCRIM = "s".repeat(64);
const owner = { id: "31", name: "개최자" };
const op = { id: "32", name: "운영자" };
const rules = { preset: "custom", scoreSource: "table", placementPoints: [10, 7, 5, 4, 3, 2, 1, 0], killMultiplier: 1, bans: "basic" };
const links = [
  { group: "A", channelId: "5001", guild: "스크림", channel: "a조" },
  { group: "B", channelId: "5002", guild: "스크림", channel: "b조" },
];

let db: typeof import("../../src/er/server/db");

beforeAll(async () => {
  db = await import("../../src/er/server/db");
  for (const u of [owner, op]) db.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
});

beforeEach(() => db.db().exec("DELETE FROM tournaments"));

async function create(body: object, token = SCRIM) {
  const { POST } = await import("../../src/app/api/bot/t/route");
  const res = await POST(new NextRequest("http://localhost/api/bot/t", { method: "POST", headers: { "x-bot-token": token }, body: JSON.stringify(body) }));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const base = { owner: owner.id, operators: [op.id, "39", owner.id], name: "10월 29일 스크림", preset: "custom", plannedRounds: 4, rules, links };

describe("스크림봇 대회 만들기", () => {
  it("스크림봇 토큰만 받음", async () => {
    expect((await create(base, "b".repeat(64))).status).toBe(404);
    expect((await create(base, "x")).status).toBe(404);
  });

  it("대회를 만들고 운영자와 조 채널을 한 번에 넣음", async () => {
    const r = await create(base);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok", reused: false, missing: ["39"] });
    const conn = db.db();
    const t = conn.prepare("SELECT * FROM tournaments WHERE code = ?").get(r.body.code) as { id: number; group_count: number; planned_rounds: number; rules: string };
    expect(t.group_count).toBe(2);
    expect(t.planned_rounds).toBe(4);
    expect(JSON.parse(t.rules)).toMatchObject({ preset: "custom", scoreSource: "table", bans: "basic" });
    expect(conn.prepare("SELECT user_id, role FROM members WHERE tournament_id = ? ORDER BY user_id").all(t.id)).toEqual([
      { user_id: owner.id, role: "owner" },
      { user_id: op.id, role: "operator" },
    ]);
    expect(conn.prepare("SELECT channel_id, group_idx FROM discord_links WHERE tournament_id = ? ORDER BY group_idx").all(t.id)).toEqual([
      { channel_id: "5001", group_idx: 0 },
      { channel_id: "5002", group_idx: 1 },
    ]);
  });

  it("같은 날 다시 부르면 같은 대회를 씀", async () => {
    const first = await create(base);
    const again = await create(base);
    expect(again.body).toMatchObject({ status: "ok", code: first.body.code, reused: true });
    const n = db.db().prepare("SELECT COUNT(*) AS n FROM tournaments").get() as { n: number };
    expect(n.n).toBe(1);
    const ops = db.db().prepare("SELECT COUNT(*) AS n FROM members WHERE role = 'operator'").get() as { n: number };
    expect(ops.n).toBe(1);
  });

  it("개최자가 내보낸 운영자는 다시 넣지 않음", async () => {
    const { body } = await create(base);
    const conn = db.db();
    const t = conn.prepare("SELECT id FROM tournaments WHERE code = ?").get(body.code) as { id: number };
    conn.prepare("DELETE FROM members WHERE tournament_id = ? AND user_id = ?").run(t.id, op.id);
    conn.prepare("INSERT INTO removals(tournament_id, user_id, removed_at) VALUES (?, ?, ?)").run(t.id, op.id, Date.now());
    await create(base);
    expect(conn.prepare("SELECT COUNT(*) AS n FROM members WHERE tournament_id = ? AND role = 'operator'").get(t.id)).toEqual({ n: 0 });
  });

  it("다음 날 대회가 같은 채널 연결을 가져감", async () => {
    const first = await create(base);
    db.db().prepare("UPDATE tournaments SET created_at = created_at - ?").run(21 * 60 * 60 * 1000);
    const next = await create({ ...base, name: "10월 30일 스크림", links: links.slice(0, 1) });
    expect(next.body.code).not.toBe(first.body.code);
    const rows = db.db().prepare("SELECT t.code, l.channel_id FROM discord_links l JOIN tournaments t ON t.id = l.tournament_id ORDER BY l.channel_id").all();
    expect(rows).toEqual([
      { code: next.body.code, channel_id: "5001" },
      { code: first.body.code, channel_id: "5002" },
    ]);
  });

  it("Labs에 없는 개최자와 잘못된 조는 거부함", async () => {
    expect((await create({ ...base, owner: "38" })).status).toBe(403);
    expect((await create({ ...base, links: [{ group: "B", channelId: "5001" }] })).status).toBe(400);
    expect((await create({ ...base, links: [links[0], { ...links[1], channelId: "5001" }] })).status).toBe(400);
    expect((await create({ ...base, links: [] })).status).toBe(400);
  });

  it("스크림봇 토큰으로 순위를 읽음", async () => {
    const { body } = await create(base);
    const { GET } = await import("../../src/app/api/bot/t/[code]/route");
    const res = await GET(new NextRequest(`http://localhost/api/bot/t/${body.code}?group=B`, { headers: { "x-bot-token": SCRIM } }), { params: Promise.resolve({ code: body.code }) });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ code: body.code, group: "B", played: 0 });
  });
});
