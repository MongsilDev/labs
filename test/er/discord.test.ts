import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csv } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-discord-"));
process.env.LABS_BOT_TOKEN = "b".repeat(64);
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const owner = { id: "21", name: "개최자", avatar: null };
const op = { id: "22", name: "운영자", avatar: null };
const stranger = { id: "23", name: "남", avatar: null };
const TOKEN = "b".repeat(64);

let t: typeof import("../../src/er/server/tournament");
let db: typeof import("../../src/er/server/db");

beforeAll(async () => {
  db = await import("../../src/er/server/db");
  t = await import("../../src/er/server/tournament");
  for (const u of [owner, op, stranger]) db.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
});

type Link = { group: string; channelId: string | null; guild?: string; channel?: string };
let channel = 1000;
const nextChannel = () => String(++channel);

async function putLinks(code: string, actor: string, links: Link[], token = TOKEN) {
  const { PUT } = await import("../../src/app/api/bot/t/[code]/links/route");
  const body = JSON.stringify({ actor, links: links.map((l) => ({ guild: "시험 서버", channel: `결과-${l.group}`, ...l })) });
  const res = await PUT(new NextRequest(`http://localhost/api/bot/t/${code}/links`, { method: "PUT", headers: { "x-bot-token": token }, body }), { params: Promise.resolve({ code }) });
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : null };
}

async function relay(channelId: string, actor: string, bytes: Buffer | string, token = TOKEN) {
  const { POST } = await import("../../src/app/api/bot/relay/route");
  const data = Buffer.from(bytes).toString("base64");
  const res = await POST(new NextRequest("http://localhost/api/bot/relay", { method: "POST", headers: { "x-bot-token": token }, body: JSON.stringify({ channelId, actor, fileName: "GameResult_.csv", data }) }));
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : null };
}

const teams = (order: string[], ks: number[] = []) => order.map((team, i) => ({ team, place: i + 1, ks: ks[i] ?? 0 }));

async function setup(groups = 2, planned = 4) {
  const code = t.createTournament(owner, { name: "디스코드", mode: "points", preset: "masters", plannedRounds: planned, groupCount: groups });
  const a = nextChannel();
  const r = await putLinks(code, owner.id, [{ group: "A", channelId: a }]);
  expect(r.status).toBe(200);
  return { code, a };
}

describe("디스코드 연결 API", () => {
  it("토큰이 틀리면 두 경로 모두 본문 없는 404", async () => {
    const { code, a } = await setup();
    expect(await putLinks(code, owner.id, [{ group: "B", channelId: nextChannel() }], "x".repeat(64))).toMatchObject({ status: 404, text: "" });
    expect(await relay(a, owner.id, csv(8001, teams(["가"])), "x".repeat(64))).toMatchObject({ status: 404, text: "" });
    expect(t.loadView(code, null)!.groups[0].rounds).toEqual([]);
  });

  it("없는 대회는 404, 운영자가 아니면 403, 없는 조는 400", async () => {
    expect(await putLinks("ZZZZZ3", owner.id, [{ group: "A", channelId: nextChannel() }])).toEqual({ status: 404, text: expect.any(String), body: { status: "gone" } });
    const { code } = await setup();
    expect((await putLinks(code, stranger.id, [{ group: "B", channelId: nextChannel() }])).body).toEqual({ status: "forbidden" });
    expect((await putLinks(code, "99999", [{ group: "B", channelId: nextChannel() }])).status).toBe(403);
    expect(await putLinks(code, owner.id, [{ group: "C", channelId: nextChannel() }])).toMatchObject({ status: 400, body: { status: "invalid" } });
  });

  it("연결과 해제를 반영하고 본문에 없는 조는 그대로 두며, 대회의 연결 전체를 돌려준다", async () => {
    const { code, a } = await setup();
    t.acceptInvite(t.createInvite(code, owner), op);
    const b = nextChannel();
    expect((await putLinks(code, op.id, [{ group: "b", channelId: b }])).body).toEqual({ status: "ok", links: [{ group: "A", channelId: a }, { group: "B", channelId: b }] });
    expect((await putLinks(code, op.id, [{ group: "A", channelId: null }])).body).toEqual({ status: "ok", links: [{ group: "B", channelId: b }] });
    expect(t.loadView(code, owner)!.logs![0]).toMatchObject({ userName: "운영자", text: "디스코드 연결 변경" });
    expect(t.discordLinks(code, owner)).toEqual([{ group: 1, guild: "시험 서버", channel: "결과-b", last: null }]);
  });

  it("다른 조나 다른 대회에 연결된 채널을 새로 연결하면 예전 연결이 풀린다", async () => {
    const x = await setup();
    const b = nextChannel();
    await putLinks(x.code, owner.id, [{ group: "B", channelId: b }]);
    expect((await putLinks(x.code, owner.id, [{ group: "B", channelId: x.a }])).body.links).toEqual([{ group: "B", channelId: x.a }]);
    const y = await setup();
    expect((await putLinks(y.code, owner.id, [{ group: "B", channelId: x.a }])).body.links).toEqual([{ group: "A", channelId: y.a }, { group: "B", channelId: x.a }]);
    expect(t.discordLinks(x.code, owner)).toEqual([]);
    expect((await relay(x.a, owner.id, csv(8101, teams(["가"])))).body).toMatchObject({ status: "added", code: y.code, group: "B" });
  });

  it("대회를 지우면 연결도 지워진다", async () => {
    const { code, a } = await setup();
    t.deleteTournament(code, owner, "디스코드");
    expect(db.db().prepare("SELECT COUNT(*) AS n FROM discord_links WHERE channel_id = ?").get(a)).toEqual({ n: 0 });
    expect((await relay(a, owner.id, csv(8151, teams(["가"])))).body).toEqual({ status: "unlinked" });
  });

  it("연결 해제 op는 운영자도 쓰고 변경 기록을 남긴다", async () => {
    const { code } = await setup();
    t.acceptInvite(t.createInvite(code, owner), op);
    t.applyOp(code, op, { op: "unlink_discord", group: 0 });
    expect(t.discordLinks(code, owner)).toEqual([]);
    expect(t.loadView(code, owner)!.logs![0]).toMatchObject({ userName: "운영자", text: "A조 디스코드 연결 해제" });
    expect(() => t.applyOp(code, stranger, { op: "unlink_discord", group: 0 })).toThrow("없는 대회이거나 이 대회의 운영자가 아닙니다.");
    expect(() => t.applyOp(code, owner, { op: "unlink_discord", group: 5 })).toThrow("없는 조입니다.");
  });
});

describe("디스코드 결과 전달 API", () => {
  it("연결 안 된 채널은 unlinked", async () => {
    expect(await relay(nextChannel(), owner.id, csv(8201, teams(["가"])))).toEqual({ status: 200, text: expect.any(String), body: { status: "unlinked" } });
  });

  it("운영자가 아니거나 가입하지 않은 사람은 forbidden이고 결과를 남기지 않는다", async () => {
    const { code, a } = await setup();
    for (const actor of [stranger.id, "99999"]) {
      const r = await relay(a, actor, csv(8301, teams(["가"])));
      expect(r).toMatchObject({ status: 200, body: { status: "forbidden", code, name: "디스코드", group: "A", groupCount: 2 } });
    }
    expect(t.loadView(code, null)!.groups[0].rounds).toEqual([]);
    expect(t.discordLinks(code, owner)[0].last).toBeNull();
  });

  it("반영하면 라운드와 순위순 ranking을 주고, 디스코드 표시와 변경 기록, 마지막 결과를 남긴다", async () => {
    const { code, a } = await setup();
    t.acceptInvite(t.createInvite(code, owner), op);
    t.applyOp(code, owner, { op: "rename_team", group: 0, from: "나", to: "나라" });
    const r = await relay(a, op.id, csv(8401, teams(["가", "나", "다"], [1, 6, 0])));
    expect(r.body).toEqual({
      status: "added",
      message: "A조 1라운드에 3팀 기록을 추가했습니다.",
      code,
      name: "디스코드",
      group: "A",
      groupCount: 2,
      url: expect.stringMatching(new RegExp(`/er/t/${code}/a$`)),
      round: 1,
      ranking: [
        { rank: 1, team: "가", score: 11 },
        { rank: 2, team: "나라", score: 13 },
        { rank: 3, team: "다", score: 5 },
      ],
    });
    const view = t.loadView(code, owner)!;
    expect(view.groups[0].rounds.map((x) => [x.roundNo, x.gameId, x.discord])).toEqual([[1, 8401, true]]);
    expect(view.logs![0]).toMatchObject({ userName: "운영자", text: "A조 1라운드 CSV 추가 (디스코드)" });
    expect(t.discordLinks(code, owner)[0].last).toMatchObject({ status: "added", round: 1, user: "운영자" });
    t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "b.csv", text: csv(8402, teams(["가"])) }] });
    expect(t.loadView(code, null)!.groups[0].rounds[1].discord).toBeUndefined();
  });

  it("같은 gameId는 끝난 조보다 먼저 duplicate로 알리고, 끝난 조는 ended", async () => {
    const { code, a } = await setup(2, 1);
    const text = csv(8501, teams(["가"]));
    expect((await relay(a, owner.id, text)).body.status).toBe("added");
    expect((await relay(a, owner.id, text)).body).toMatchObject({ status: "duplicate", message: "이미 A조 1라운드에 올린 경기입니다." });
    expect(t.discordLinks(code, owner)[0].last).toMatchObject({ status: "duplicate", round: 1, user: "개최자" });
    expect((await relay(a, owner.id, csv(8502, teams(["가"])))).body).toMatchObject({ status: "ended", message: "A조 경기가 끝났습니다.", group: "A" });
    expect(t.discordLinks(code, owner)[0].last).toMatchObject({ status: "ended", round: null });
  });

  it("게임 결과 CSV가 아니거나 200KB를 넘으면 invalid", async () => {
    const { code, a } = await setup();
    expect((await relay(a, owner.id, "a,b\n1,2\n")).body).toMatchObject({ status: "invalid", message: expect.stringContaining("없는 열: teamName") });
    expect((await relay(a, owner.id, "x".repeat(200_001))).body).toMatchObject({ status: "invalid", message: "200KB가 넘는 파일은 올릴 수 없습니다." });
    expect(t.discordLinks(code, owner)[0].last).toMatchObject({ status: "invalid", round: null });
    expect(t.loadView(code, null)!.groups[0].rounds).toEqual([]);
  });

  it("UTF-16으로 저장한 파일도 읽는다", async () => {
    const { code, a } = await setup();
    const text = csv(8601, teams(["가"]));
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/^﻿/, ""), "utf16le")]);
    expect((await relay(a, owner.id, bytes)).body.status).toBe("added");
    expect(t.loadView(code, null)!.groups[0].rounds[0].players[0].team).toBe("가");
  });
});
