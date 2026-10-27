import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
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

// 개최자 한 명이 만들 수 있는 대회 수에 걸리지 않게 시험마다 비움
beforeEach(() => db.db().exec("DELETE FROM tournaments"));

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

async function relay(channelId: string, actor: string, bytes: Buffer | string, token = TOKEN, actorName?: string) {
  const { POST } = await import("../../src/app/api/bot/relay/route");
  const data = Buffer.from(bytes).toString("base64");
  const res = await POST(
    new NextRequest("http://localhost/api/bot/relay", { method: "POST", headers: { "x-bot-token": token }, body: JSON.stringify({ channelId, actor, actorName, fileName: "GameResult_.csv", data }) }),
  );
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : null };
}

async function getBot(path: string, token = TOKEN) {
  const url = new URL(`http://localhost${path}`);
  const req = new NextRequest(url, { headers: { "x-bot-token": token } });
  const code = url.pathname.split("/")[4];
  const res =
    url.pathname === "/api/bot/links"
      ? await (await import("../../src/app/api/bot/links/route")).GET(req)
      : url.pathname.endsWith("/links")
        ? await (await import("../../src/app/api/bot/t/[code]/links/route")).GET(req, { params: Promise.resolve({ code }) })
        : await (await import("../../src/app/api/bot/t/[code]/route")).GET(req, { params: Promise.resolve({ code }) });
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
    expect(t.discordLinks(code, owner)).toEqual([{ group: 1, channelId: b, guild: "시험 서버", channel: "결과-b", last: null }]);
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

  it("운영자가 아닌 사람과 labs 사용자가 아닌 사람이 올린 결과도 반영하고, labs 사용자가 아니면 디스코드 표시 이름으로 남긴다", async () => {
    const { code, a } = await setup(2, 6);
    const cases: [string, string | undefined, string][] = [
      [stranger.id, "디코이름", "남"],
      ["99999", "결과 올린 사람", "결과 올린 사람"],
      ["99998", "가".repeat(40), "가".repeat(32)],
      ["99997", undefined, "디스코드 사용자"],
    ];
    for (const [i, [actor, actorName, shown]] of cases.entries()) {
      const r = await relay(a, actor, csv(8301 + i, teams(["가"])), TOKEN, actorName);
      expect(r).toMatchObject({ status: 200, body: { status: "added", code, group: "A", round: i + 1 } });
      expect(t.loadView(code, owner)!.logs![0]).toMatchObject({ userName: shown, text: `A조 ${i + 1}라운드 CSV 추가 (디스코드)` });
      expect(t.discordLinks(code, owner)[0].last).toMatchObject({ status: "added", round: i + 1, user: shown });
    }
    expect(t.loadView(code, null)!.groups[0].rounds.map((x) => x.discord)).toEqual([true, true, true, true]);
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

describe("디스코드 연결 읽기 API", () => {
  it("토큰이 틀리면 두 경로 모두 본문 없는 404", async () => {
    const { code } = await setup();
    expect(await getBot(`/api/bot/t/${code}/links`, "x".repeat(64))).toMatchObject({ status: 404, text: "" });
    expect(await getBot("/api/bot/links", "x".repeat(64))).toMatchObject({ status: 404, text: "" });
  });

  it("대회 하나의 연결을 이름과 함께 돌려주고, 없거나 지운 대회는 gone", async () => {
    const { code, a } = await setup();
    expect((await getBot(`/api/bot/t/${code.toLowerCase()}/links`)).body).toEqual({ status: "ok", links: [{ group: "A", channelId: a, guild: "시험 서버", channel: "결과-A" }] });
    t.deleteTournament(code, owner, "디스코드");
    expect(await getBot(`/api/bot/t/${code}/links`)).toMatchObject({ status: 404, body: { status: "gone" } });
    expect(await getBot("/api/bot/t/ZZZZZ3/links")).toMatchObject({ status: 404, body: { status: "gone" } });
  });

  it("연결 전체에서 끝난 대회, 보관 기간이 지난 대회, 지운 대회는 뺀다", async () => {
    const live = await setup(2, 1);
    const done = await setup(1, 1);
    await relay(done.a, owner.id, csv(8701, teams(["가"])));
    const old = await setup(1, 4);
    db.db().prepare("UPDATE tournaments SET updated_at = ? WHERE code = ?").run(Date.now() - 25 * 3_600_000, old.code);
    const gone = await setup(1, 4);
    t.deleteTournament(gone.code, owner, "디스코드");
    // 두 조 가운데 한 조만 끝난 대회는 남김
    await relay(live.a, owner.id, csv(8702, teams(["가"])));
    const { links } = (await getBot("/api/bot/links")).body as { links: { channelId: string; code: string; group: string }[] };
    expect(links).toContainEqual({ channelId: live.a, code: live.code, group: "A" });
    for (const x of [done, old, gone]) expect(links.some((l) => l.code === x.code || l.channelId === x.a)).toBe(false);
  });

  it("순위 응답에 그 조에 연결된 채널 ID를 넣는다", async () => {
    const { code, a } = await setup();
    expect((await getBot(`/api/bot/t/${code}?group=a`)).body).toMatchObject({ group: "A", channelId: a });
    expect((await getBot(`/api/bot/t/${code}?group=B`)).body).toMatchObject({ group: "B", channelId: null });
    expect((await getBot("/api/bot/t/EXAMPLE")).body).toMatchObject({ channelId: null });
  });

  it("대회 보기 응답의 연결 정보는 개최자와 운영자에게만 넣는다", async () => {
    const { code } = await setup();
    expect(t.loadView(code, owner)!.discord).toEqual([{ group: 0, channel: "결과-A" }]);
    expect(t.loadView(code, stranger)!.discord).toBeUndefined();
    expect(t.loadView(code, null)!.discord).toBeUndefined();
  });
});

type Guilds = { id: string; name: string; channels: { id: string; name: string }[] }[];

function stubBot(guilds: Guilds | "fail" = []) {
  const calls: { url: string; method: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : null });
      if (String(url).includes("/api/t/changed")) return new Response(null, { status: 202 });
      if (guilds === "fail") return new Response("", { status: 500 });
      return Response.json({ guilds });
    }),
  );
  return calls;
}

describe("관리 화면 채널 연결", () => {
  const guildA = { id: "500", name: "시험 서버", channels: [{ id: "601", name: "결과-1" }, { id: "602", name: "결과-2" }] };
  beforeAll(() => {
    process.env.BOT_API_URL = "http://bot.test";
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(() => {
    delete process.env.BOT_API_URL;
  });

  const post = (code: string, user: typeof owner, op: { group: number; channelId: string }) => t.linkDiscord(code, user, op.group, op.channelId);

  it("봇 목록에 있는 채널만 연결하고, 운영자가 아니면 봇을 부르지 않고 거부한다", async () => {
    const calls = stubBot([guildA]);
    const { code } = await setup();
    await expect(post(code, owner, { group: 1, channelId: "699" })).rejects.toThrow("이 채널은 연결할 수 없습니다.\n목록에 있는 채널을 골라주세요.");
    const before = calls.length;
    await expect(post(code, stranger, { group: 1, channelId: "601" })).rejects.toThrow("없는 대회이거나 이 대회의 운영자가 아닙니다.");
    expect(calls.length).toBe(before);
    const r = await post(code, owner, { group: 1, channelId: "601" });
    expect(r.ok).toBe(true);
    expect(calls.find((c) => c.method === "GET")!.url).toBe(`http://bot.test/api/t/channels?user=${owner.id}`);
    expect(t.discordLinks(code, owner).map((l) => [l.group, l.channelId, l.guild, l.channel])).toContainEqual([1, "601", "시험 서버", "결과-1"]);
    expect(t.loadView(code, owner)!.logs![0]).toMatchObject({ userName: "개최자", text: "디스코드 연결 변경" });
  });

  it("봇 목록을 받지 못하면 저장하지 않는다", async () => {
    stubBot("fail");
    const { code } = await setup();
    await expect(post(code, owner, { group: 1, channelId: "601" })).rejects.toThrow("연결하지 못했습니다.\n잠시 후 다시 시도해주세요.");
    expect(t.discordLinks(code, owner).map((l) => l.group)).toEqual([0]);
  });

  it("다른 조나 다른 대회에 걸린 채널을 고르면 예전 연결이 풀린다", async () => {
    stubBot([guildA]);
    const x = await setup();
    await post(x.code, owner, { group: 0, channelId: "602" });
    expect(t.discordLinks(x.code, owner).map((l) => [l.group, l.channelId])).toEqual([[0, "602"]]);
    await post(x.code, owner, { group: 1, channelId: "602" });
    expect(t.discordLinks(x.code, owner).map((l) => [l.group, l.channelId])).toEqual([[1, "602"]]);
    const y = await setup();
    await post(y.code, owner, { group: 1, channelId: "602" });
    expect(t.discordLinks(x.code, owner)).toEqual([]);
    expect(t.discordLinks(y.code, owner).map((l) => [l.group, l.channelId])).toEqual([[0, y.a], [1, "602"]]);
  });

  it("쓰기 경로에서 바로 applyOp로 보낸 연결은 받지 않는다", async () => {
    const { code } = await setup();
    expect(() => t.applyOp(code, owner, { op: "link_discord", group: 1, channelId: "601" })).toThrow("알 수 없는 요청입니다.");
  });
});

describe("봇에 변경 알림", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BOT_API_URL;
  });

  it("커밋한 트랜잭션마다 한 번 알리고, 되돌린 트랜잭션은 알리지 않는다", async () => {
    const { code, a } = await setup(1, 6);
    process.env.BOT_API_URL = "http://bot.test/";
    const calls = stubBot();
    const changed = () => calls.filter((c) => c.url === "http://bot.test/api/t/changed");
    // 파일 세 개를 한 번에 올리면 bump는 세 번이지만 알림은 한 번
    t.applyOp(code, owner, { op: "add_csv", group: 0, files: [8801, 8802, 8803].map((id) => ({ name: `${id}.csv`, text: csv(id, teams(["가"])) })) });
    expect(changed()).toEqual([{ url: "http://bot.test/api/t/changed", method: "POST", body: { code } }]);
    await relay(a, owner.id, csv(8804, teams(["가"])));
    expect(changed().length).toBe(2);
    expect(() => t.applyOp(code, owner, { op: "update_settings", plannedRounds: 1 })).toThrow();
    expect(changed().length).toBe(2);
    t.deleteTournament(code, owner, "디스코드");
    expect(changed().length).toBe(3);
  });

  it("알림이 실패해도 쓰기는 성공한다", async () => {
    const { code } = await setup(1, 4);
    process.env.BOT_API_URL = "http://bot.test";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("연결 거부"))));
    expect(t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "a.csv", text: csv(8901, teams(["가"])) }] }).ok).toBe(true);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("동기 실패"); }));
    expect(t.applyOp(code, owner, { op: "delete_round", id: t.loadView(code, null)!.groups[0].rounds[0].id }).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(t.loadView(code, null)!.groups[0].rounds).toEqual([]);
    warn.mockRestore();
  });

  it("BOT_API_URL이 없는 테스트 환경에서는 알리지 않는다", async () => {
    const calls = stubBot();
    const { code } = await setup(1, 4);
    t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "a.csv", text: csv(9001, teams(["가"])) }] });
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(calls).toEqual([]);
  });
});
