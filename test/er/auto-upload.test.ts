import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { csv, type TeamSpec } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-auto-"));
process.env.LABS_SCRIM_TOKEN = "s".repeat(64);
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const owner = { id: "41", name: "개최자", avatar: null };
const op = { id: "42", name: "운영자", avatar: null };
const other = { id: "43", name: "남", avatar: null };

let t: typeof import("../../src/er/server/tournament");
let db: typeof import("../../src/er/server/db");

beforeAll(async () => {
  db = await import("../../src/er/server/db");
  t = await import("../../src/er/server/tournament");
});

const ENV = ["AUTO_UPLOAD_SHIP", "AUTO_UPLOAD_MANY", "AUTO_UPLOAD_FIRST", "AUTO_UPLOAD_OPTIN"];
// cleanup 시험이 세션 없는 사용자를 지우므로 매번 다시 넣음
beforeEach(() => {
  db.db().exec("DELETE FROM tournaments; DELETE FROM upload_tokens");
  for (const u of [owner, op, other]) db.db().prepare("INSERT OR IGNORE INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
});
afterEach(() => ENV.forEach((k) => delete process.env[k]));

// 팀 이름과 닉네임은 시험용 가짜 값
const team = (name: string, place: number): TeamSpec => ({ team: name, place, ks: 1, players: [1, 2, 3].map((i) => ({ nick: `${name}${i}` })) });
const lobby = (gameId: number, names: string[]) => csv(gameId, names.map((n, i) => team(n, i + 1)));
const roster = (names: string[]) => names.flatMap((n) => [1, 2, 3].map((i) => `${n}${i}`));
const A = ["가", "나", "다"];
const B = ["라", "마", "바"];

let ip = 0;
async function send(token: string | null, body: string, accept = "application/json") {
  const { POST } = await import("../../src/app/api/upload/me/route");
  const h: Record<string, string> = { "x-forwarded-for": `203.0.113.${++ip % 250}`, accept };
  if (token !== null) h["x-upload-token"] = token;
  const res = await POST(new NextRequest("http://localhost/api/upload/me", { method: "POST", headers: h, body }));
  const text = await res.text();
  return { status: res.status, text, body: accept.includes("json") && text ? (JSON.parse(text) as { status: string; message: string }) : null };
}

async function scrim(body: object = {}) {
  const { POST } = await import("../../src/app/api/bot/t/route");
  const links = [
    { group: "A", channelId: "6001", guild: "스크림", channel: "a조", roster: roster(A) },
    { group: "B", channelId: "6002", guild: "스크림", channel: "b조", roster: roster(B) },
  ];
  const res = await POST(
    new NextRequest("http://localhost/api/bot/t", {
      method: "POST",
      headers: { "x-bot-token": "s".repeat(64) },
      body: JSON.stringify({ owner: owner.id, operators: [op.id], name: `스크림 ${Math.random()}`, preset: "masters", plannedRounds: 4, links, autoUpload: true, ...body }),
    }),
  );
  return (await res.json()) as { status: string; code: string };
}

const rounds = (code: string) => t.loadView(code, owner)!.groups.map((g) => g.rounds.map((r) => r.gameId));

describe("업로드 토큰", () => {
  it("해시만 저장하고, 다시 발급하면 이전 토큰은 401", async () => {
    const first = t.issueUploadToken(op);
    const row = db.db().prepare("SELECT hash FROM upload_tokens WHERE user_id = ?").get(op.id) as { hash: string };
    expect(row.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.hash).not.toContain(first);
    const second = t.issueUploadToken(op);
    expect((await send(first, lobby(1, A))).status).toBe(401);
    expect((await send(second, lobby(1, A))).status).toBe(422);
    t.revokeUploadToken(op);
    expect((await send(second, lobby(1, A))).status).toBe(401);
    expect((await send(null, lobby(1, A))).status).toBe(401);
  });

  it("text/plain을 달라고 하면 문장만 돌려줌", async () => {
    const r = await send("unknown-token", lobby(1, A), "text/plain");
    expect(r).toMatchObject({ status: 401, text: "토큰이 폐기됐습니다. Labs에서 새 토큰을 받아주세요." });
  });

  it("토큰 하나는 1분에 10번까지 받고 그다음은 429", async () => {
    const value = t.issueUploadToken(other);
    for (let i = 0; i < 10; i++) expect((await send(value, lobby(100 + i, A))).status).toBe(422);
    expect((await send(value, lobby(200, A))).status).toBe(429);
  });

  it("cleanup은 토큰이 있는 사용자를 남기고, 90일 동안 쓰지 않은 토큰은 지움", () => {
    const ghost = { id: "49", name: "유령", avatar: null };
    db.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(ghost.id, ghost.name, Date.now());
    t.issueUploadToken(ghost);
    t.cleanup();
    expect(db.db().prepare("SELECT 1 FROM users WHERE id = ?").get(ghost.id)).toBeTruthy();
    db.db().prepare("UPDATE upload_tokens SET created_at = ? WHERE user_id = ?").run(Date.now() - 91 * 86_400_000, ghost.id);
    t.cleanup();
    expect(db.db().prepare("SELECT 1 FROM upload_tokens WHERE user_id = ?").get(ghost.id)).toBeUndefined();
    expect(db.db().prepare("SELECT 1 FROM users WHERE id = ?").get(ghost.id)).toBeUndefined();
  });
});

describe("조 판정", () => {
  it("명단이 맞는 조에 들어가고, 로그에 토큰 주인과 자동 업로드가 남음", async () => {
    const { code } = await scrim();
    const value = t.issueUploadToken(op);
    const r = await send(value, lobby(7001, B));
    expect(r).toMatchObject({ status: 200, body: { status: "added", message: "B조 1라운드에 3팀 기록을 추가했습니다." } });
    expect(rounds(code)).toEqual([[], [7001]]);
    expect(t.loadView(code, owner)!.logs![0]).toMatchObject({ userName: "운영자", text: "B조 1라운드 CSV 추가 (자동 업로드)" });
  });

  it("대타가 섞여도 절반 이상이 명단에 있으면 그 조로 봄", async () => {
    const { code } = await scrim();
    const value = t.issueUploadToken(op);
    const mixed = csv(7002, [team("가", 1), team("나", 2), team("대타", 3)]);
    expect((await send(value, mixed)).status).toBe(200);
    expect(rounds(code)).toEqual([[7002], []]);
  });

  it("명단과 맞지 않는 경기는 저장하지 않고 422", async () => {
    const { code } = await scrim();
    const value = t.issueUploadToken(op);
    const r = await send(value, lobby(7003, ["사", "아", "자"]));
    expect(r).toMatchObject({ status: 422, body: { status: "invalid", message: "명단이 맞는 조가 없어 반영하지 않았습니다." } });
    expect(rounds(code)).toEqual([[], []]);
  });

  it("같은 경기는 409, 끝난 조는 410", async () => {
    const { code } = await scrim({ plannedRounds: 1 });
    const value = t.issueUploadToken(op);
    expect((await send(value, lobby(7004, A))).status).toBe(200);
    expect((await send(value, lobby(7004, A))).body).toMatchObject({ status: "duplicate", message: "이미 A조 1라운드에 올린 경기입니다." });
    expect((await send(value, lobby(7005, A))).body).toMatchObject({ status: "ended", message: "A조 경기가 끝났습니다." });
    expect(rounds(code)).toEqual([[7004], []]);
  });

  it("끝난 조는 후보에서 빠져, 같은 선수들의 다음 대회 경기는 새 대회로 감", async () => {
    const one = await scrim({ plannedRounds: 1 });
    const value = t.issueUploadToken(op);
    expect((await send(value, lobby(7007, A))).status).toBe(200);
    const two = await scrim();
    expect((await send(value, lobby(7008, A))).status).toBe(200);
    expect([rounds(one.code), rounds(two.code)]).toEqual([[[7007], []], [[7008], []]]);
  });

  it("조 수를 줄이면 줄인 조의 명단도 지움", async () => {
    const { code } = await scrim();
    t.applyOp(code, owner, { op: "update_settings", groupCount: 1 });
    t.applyOp(code, owner, { op: "update_settings", groupCount: 2 });
    expect(db.db().prepare("SELECT group_idx FROM group_rosters WHERE tournament_id = (SELECT id FROM tournaments WHERE code = ?)").all(code)).toEqual([{ group_idx: 0 }]);
  });

  it("운영진에서 빠지거나 대회에 속하지 않은 사람의 토큰은 후보가 없어 422", async () => {
    const { code } = await scrim();
    const value = t.issueUploadToken(other);
    expect((await send(value, lobby(7006, A))).body).toMatchObject({ status: "invalid", message: "자동 업로드를 받는 대회가 없습니다." });
    const opValue = t.issueUploadToken(op);
    t.removeMember(code, owner, op.id);
    expect((await send(opValue, lobby(7006, A))).status).toBe(422);
    expect(rounds(code)).toEqual([[], []]);
  });

  it("CSV가 아니면 422", async () => {
    await scrim();
    expect((await send(t.issueUploadToken(op), "hello"))).toMatchObject({ status: 422 });
  });
});

describe("352-3 명단이 맞는 조가 여럿일 때", () => {
  it("roster: 반영하지 않음", async () => {
    const one = await scrim();
    const two = await scrim();
    const r = await send(t.issueUploadToken(op), lobby(7101, A));
    expect(r).toMatchObject({ status: 422, body: { message: "명단이 맞는 조가 여럿이라 반영하지 않았습니다. 디스코드나 Labs에서 직접 올려주세요." } });
    expect([rounds(one.code), rounds(two.code)]).toEqual([[[], []], [[], []]]);
  });

  it("latest: 가장 최근에 바뀐 대회의 조", async () => {
    process.env.AUTO_UPLOAD_MANY = "latest";
    const one = await scrim();
    const two = await scrim();
    db.db().prepare("UPDATE tournaments SET updated_at = updated_at - 1000 WHERE code = ?").run(one.code);
    expect((await send(t.issueUploadToken(op), lobby(7102, A))).status).toBe(200);
    expect([rounds(one.code), rounds(two.code)]).toEqual([[[], []], [[7102], []]]);
  });

  it("roster: 끝난 대회와도 맞아도 여럿이라는 안내를 그대로 돌려줌", async () => {
    const old = await scrim({ plannedRounds: 1 });
    const value = t.issueUploadToken(op);
    expect((await send(value, lobby(7104, A))).status).toBe(200);
    await scrim();
    await scrim();
    expect((await send(value, lobby(7105, A))).body).toMatchObject({ status: "invalid", message: "명단이 맞는 조가 여럿이라 반영하지 않았습니다. 디스코드나 Labs에서 직접 올려주세요." });
    expect(rounds(old.code)).toEqual([[7104], []]);
  });

  it("다른 대회에 이미 올린 경기는 명단이 맞는 새 대회에 넣지 않고 409", async () => {
    process.env.AUTO_UPLOAD_MANY = "latest";
    const one = await scrim();
    const value = t.issueUploadToken(op);
    expect((await send(value, lobby(7103, A))).status).toBe(200);
    const two = await scrim();
    expect((await send(value, lobby(7103, A))).status).toBe(409);
    expect(rounds(two.code)).toEqual([[], []]);
    expect(rounds(one.code)).toEqual([[7103], []]);
  });
});

describe("352-4 명단도 기록도 없는 조의 첫 경기", () => {
  const plain = () => {
    const code = t.createTournament(owner, { name: "일반", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 1 });
    t.setAutoUpload(code, owner, true);
    return code;
  };

  it("single: 이름을 모르는 조가 하나뿐이면 반영하고, 다음 경기부터는 지난 경기 닉네임으로 맞춤", async () => {
    const code = plain();
    const value = t.issueUploadToken(owner);
    expect((await send(value, lobby(7201, A))).status).toBe(200);
    expect((await send(value, lobby(7202, A))).status).toBe(200);
    expect((await send(value, lobby(7203, B))).status).toBe(422);
    expect(rounds(code)).toEqual([[7201, 7202]]);
  });

  it("single: 이름을 모르는 조가 둘이면 반영하지 않음", async () => {
    plain();
    plain();
    expect((await send(t.issueUploadToken(owner), lobby(7204, A))).status).toBe(422);
  });

  it("single: 다른 조 명단과 일부라도 겹친 경기는 이름을 모르는 조에 넣지 않음", async () => {
    const s = await scrim();
    const code = plain();
    const value = t.issueUploadToken(owner);
    const mostlySubs = csv(7206, [team("가", 1), team("대타1", 2), team("대타2", 3)]);
    expect((await send(value, mostlySubs)).status).toBe(422);
    expect([rounds(s.code), rounds(code)]).toEqual([[[], []], [[]]]);
  });

  it("reject: 첫 경기는 직접 올려야 함", async () => {
    process.env.AUTO_UPLOAD_FIRST = "reject";
    const code = plain();
    expect((await send(t.issueUploadToken(owner), lobby(7205, A))).status).toBe(422);
    expect(rounds(code)).toEqual([[]]);
  });
});

describe("352-5 대회 자동 업로드 처음 상태", () => {
  const plain = () => t.createTournament(owner, { name: "일반", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 1 });

  it("off: 새 대회는 꺼져 있고 개최자만 켬. 스크림봇 대회는 켜져 있음", async () => {
    const code = plain();
    expect(t.autoUploadOf(code, owner)).toBe(false);
    expect((await send(t.issueUploadToken(owner), lobby(7301, A))).status).toBe(422);
    expect(() => t.setAutoUpload(code, op, true)).toThrow();
    t.setAutoUpload(code, owner, true);
    expect(t.autoUploadOf(code, owner)).toBe(true);
    expect(t.loadView(code, owner)!.logs![0]).toMatchObject({ text: "자동 업로드 켜기" });
    const s = await scrim();
    expect(t.autoUploadOf(s.code, owner)).toBe(true);
  });

  it("off: 개최자가 끈 스크림 대회는 같은 날 다시 불려도 켜지 않음", async () => {
    const s = await scrim({ name: "같은 스크림" });
    t.setAutoUpload(s.code, owner, false);
    const again = await scrim({ name: "같은 스크림" });
    expect(again.code).toBe(s.code);
    expect(t.autoUploadOf(s.code, owner)).toBe(false);
  });

  it("on: 새 대회도 켜져 있음", () => {
    process.env.AUTO_UPLOAD_OPTIN = "on";
    expect(t.autoUploadOf(plain(), owner)).toBe(true);
  });

  it("none: 설정 없이 운영하는 모든 대회가 후보", async () => {
    process.env.AUTO_UPLOAD_OPTIN = "none";
    const code = plain();
    expect((await send(t.issueUploadToken(owner), lobby(7302, A))).status).toBe(200);
    expect(rounds(code)).toEqual([[7302]]);
  });
});

describe("스크림봇 명단", () => {
  it("명단 형식이 틀려도 대회는 만들고 명단만 버림", async () => {
    const links = [{ group: "A", channelId: "6101", guild: "스크림", channel: "a조", roster: "가1" }, { group: "B", channelId: "6102", guild: "스크림", channel: "b조", roster: [1, null, "라1", " 라1 "] }];
    const r = await scrim({ links });
    expect(r.status).toBe("ok");
    const rows = db.db().prepare("SELECT group_idx, names FROM group_rosters WHERE tournament_id = (SELECT id FROM tournaments WHERE code = ?)").all(r.code);
    expect(rows).toEqual([{ group_idx: 1, names: JSON.stringify(["라1"]) }]);
  });

  it("같은 날 다시 조편성하면 명단을 바꿈", async () => {
    const first = await scrim({ name: "다시" });
    const swapped = [
      { group: "A", channelId: "6001", guild: "스크림", channel: "a조", roster: roster(B) },
      { group: "B", channelId: "6002", guild: "스크림", channel: "b조", roster: roster(A) },
    ];
    const again = await scrim({ name: "다시", links: swapped });
    expect(again.code).toBe(first.code);
    expect((await send(t.issueUploadToken(op), lobby(7401, A))).status).toBe(200);
    expect(rounds(first.code)).toEqual([[], [7401]]);
  });
});

describe("감시 파일", () => {
  it("CRLF로 내보내고, BOM과 자리 표시가 남지 않음", async () => {
    const { watchScript } = await import("../../src/er/server/watchScript");
    const s = watchScript({ token: "tok-_9", url: "https://labs.example/api/upload/me" });
    expect(s.startsWith("@echo off\r\n")).toBe(true);
    expect(s.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(s).toContain('set "LABS_TOKEN=tok-_9"');
    expect(s).toContain('set "LABS_URL=https://labs.example/api/upload/me"');
    expect(s).not.toContain("{{");
    expect(s).toContain('if not "tok-_9"=="" if not defined LABS_MIN');
    const paste = watchScript({ token: "", url: "u" });
    expect(paste).toContain('set "LABS_TOKEN="\r\n');
    expect(paste).toContain('if not ""=="" if not defined LABS_MIN');
  });
});
