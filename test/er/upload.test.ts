import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csv } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-upload-"));
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const owner = { id: "11", name: "개최자", avatar: null };
const op = { id: "12", name: "운영자", avatar: null };
const stranger = { id: "13", name: "남", avatar: null };

let t: typeof import("../../src/er/server/tournament");
let db: typeof import("../../src/er/server/db");

beforeAll(async () => {
  db = await import("../../src/er/server/db");
  t = await import("../../src/er/server/tournament");
  for (const u of [owner, op, stranger]) db.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
});

const teams = (order: string[]) => order.map((team, i) => ({ team, place: i + 1, ks: 1 }));
let ip = 0;

// 요청마다 다른 IP로 보내 IP 제한이 다른 시험에 섞이지 않게 함
async function upload(code: string, group: string, key: string | null, body: BodyInit, headers: Record<string, string> = {}) {
  const { POST } = await import("../../src/app/api/upload/[code]/[group]/route");
  const h: Record<string, string> = { "x-forwarded-for": `198.51.100.${++ip % 250}`, ...headers };
  if (key !== null) h["x-upload-key"] = key;
  const res = await POST(new NextRequest(`http://localhost/api/upload/${code}/${group}`, { method: "POST", headers: h, body }), { params: Promise.resolve({ code, group }) });
  const text = await res.text();
  return { status: res.status, text, body: text ? (JSON.parse(text) as { status: string; message: string }) : null, retry: res.headers.get("retry-after") };
}

function setup(groups = 2, planned = 4, mode: "points" | "checkpoint" = "points") {
  const code = t.createTournament(owner, { name: "자동", mode, preset: "masters", plannedRounds: planned, groupCount: groups });
  const { key } = t.issueUploadKey(code, owner, 0);
  return { code, key };
}

describe("업로드 키", () => {
  it("발급한 키는 해시만 저장하고, 조마다 하나만 있다", () => {
    const { code, key } = setup();
    const rows = db.db().prepare("SELECT hash FROM upload_keys WHERE tournament_id = (SELECT id FROM tournaments WHERE code = ?)").all(code) as { hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].hash).not.toContain(key);
    expect(rows[0].hash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => t.issueUploadKey(code, owner, 0)).toThrow("A조에는 이미 업로드 키가 있습니다.");
    expect(() => t.issueUploadKey(code, owner, 2)).toThrow("없는 조입니다.");
    expect(t.uploadKeys(code, owner)).toMatchObject([{ group: 0, createdBy: "개최자", lastUsedAt: null }]);
  });

  it("운영자도 발급하고 폐기하며, 운영자가 아니면 할 수 없다", () => {
    const { code } = setup();
    t.acceptInvite(t.createInvite(code, owner), op);
    t.issueUploadKey(code, op, 1);
    expect(t.uploadKeys(code, owner).map((k) => [k.group, k.createdBy])).toEqual([[0, "개최자"], [1, "운영자"]]);
    t.revokeUploadKey(code, op, 0);
    expect(t.uploadKeys(code, op).map((k) => k.group)).toEqual([1]);
    expect(() => t.issueUploadKey(code, stranger, 0)).toThrow("없는 대회이거나 이 대회의 운영자가 아닙니다.");
    expect(() => t.uploadKeys(code, stranger)).toThrow("없는 대회이거나 이 대회의 운영자가 아닙니다.");
    expect(t.loadView(code, owner)!.logs!.map((l) => `${l.userName} ${l.text}`).slice(0, 3)).toEqual(["운영자 A조 업로드 키 폐기", "운영자 B조 업로드 키 발급", "운영자 운영자로 참여"]);
  });
});

describe("업로드 API", () => {
  it("키로 올린 CSV는 그 조의 빈 라운드에 들어가고, 로그에 발급한 사람과 자동 업로드가 남는다", async () => {
    const { code, key } = setup();
    const r = await upload(code, "a", key, csv(7001, teams(["가", "나"])));
    expect(r).toMatchObject({ status: 200, body: { status: "added", message: "A조 1라운드에 2팀 기록을 추가했습니다." } });
    const view = t.loadView(code, owner)!;
    expect(view.groups[0].rounds.map((x) => [x.roundNo, x.gameId, x.fileName])).toEqual([[1, 7001, "GameResult_.csv"]]);
    expect(view.logs![0]).toMatchObject({ userName: "개최자", text: "A조 1라운드 CSV 추가 (자동 업로드)" });
    expect(t.uploadKeys(code, owner)[0].lastUsedAt).toBeGreaterThan(0);
  });

  it("키가 없거나 틀리면 본문 없는 404", async () => {
    const { code } = setup();
    for (const key of [null, "", "x".repeat(43), "x".repeat(500)]) {
      const r = await upload(code, "a", key, csv(7101, teams(["가"])));
      expect([key?.length, r.status, r.text]).toEqual([key?.length, 404, ""]);
    }
    expect(t.loadView(code, null)!.groups[0].rounds).toEqual([]);
  });

  it("폐기한 키, 다른 조 키, 다른 대회 키는 404", async () => {
    const a = setup();
    const b = setup();
    expect((await upload(a.code, "b", a.key, csv(7201, teams(["가"])))).status).toBe(404);
    expect((await upload(b.code, "a", a.key, csv(7202, teams(["가"])))).status).toBe(404);
    expect((await upload("ZZZZZ3", "a", a.key, csv(7203, teams(["가"])))).status).toBe(404);
    t.revokeUploadKey(a.code, owner, 0);
    expect(await upload(a.code, "a", a.key, csv(7204, teams(["가"])))).toMatchObject({ status: 404, text: "" });
    expect(t.loadView(a.code, null)!.groups.flatMap((g) => g.rounds)).toEqual([]);
    expect(t.loadView(b.code, null)!.groups.flatMap((g) => g.rounds)).toEqual([]);
  });

  it("발급한 사람이 운영자에서 빠지면 그 키는 404", async () => {
    const code = t.createTournament(owner, { name: "빠짐", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 1 });
    t.acceptInvite(t.createInvite(code, owner), op);
    const { key } = t.issueUploadKey(code, op, 0);
    t.removeMember(code, owner, op.id);
    expect((await upload(code, "a", key, csv(7301, teams(["가"])))).status).toBe(404);
    expect(t.uploadKeys(code, owner)).toEqual([]);
  });

  it("끝난 조는 410, 보관 기간이 지나거나 삭제된 대회는 404", async () => {
    const done = setup(1, 1);
    expect((await upload(done.code, "a", done.key, csv(7401, teams(["가"])))).status).toBe(200);
    expect(await upload(done.code, "a", done.key, csv(7402, teams(["가"])))).toMatchObject({ status: 410, body: { status: "ended", message: "끝난 대회입니다." } });

    const old = setup();
    db.db().prepare("UPDATE tournaments SET updated_at = ? WHERE code = ?").run(Date.now() - 25 * 3600_000, old.code);
    expect((await upload(old.code, "a", old.key, csv(7403, teams(["가"])))).status).toBe(404);

    const gone = setup();
    t.deleteTournament(gone.code, owner, "자동");
    expect((await upload(gone.code, "a", gone.key, csv(7404, teams(["가"])))).status).toBe(404);
    expect(db.db().prepare("SELECT COUNT(*) AS n FROM upload_keys WHERE tournament_id NOT IN (SELECT id FROM tournaments)").get()).toEqual({ n: 0 });
  });

  it("같은 gameId는 409로 이미 올린 경기라고 알리고 기록을 늘리지 않는다", async () => {
    const { code, key } = setup();
    const text = csv(7501, teams(["가", "나"]));
    expect((await upload(code, "a", key, text)).status).toBe(200);
    expect(await upload(code, "a", key, text)).toMatchObject({ status: 409, body: { status: "duplicate", message: "이미 A조 1라운드에 올린 경기입니다." } });
    t.applyOp(code, owner, { op: "add_csv", group: 1, files: [{ name: "b.csv", text: csv(7502, teams(["가"])) }] });
    expect(await upload(code, "a", key, csv(7502, teams(["가"])))).toMatchObject({ status: 409, body: { message: "이미 B조 1라운드에 올린 경기입니다." } });
    expect(t.loadView(code, null)!.groups[0].rounds).toHaveLength(1);
  });

  it("결과 CSV가 아니면 422, 200KB를 넘으면 413", async () => {
    const { code, key } = setup();
    expect(await upload(code, "a", key, "a,b\n1,2\n")).toMatchObject({ status: 422, body: { status: "invalid", message: expect.stringContaining("없는 열: teamName") } });
    expect((await upload(code, "a", key, "x".repeat(200_001))).status).toBe(413);
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(new Uint8Array(64 * 1024));
      },
    });
    const { POST } = await import("../../src/app/api/upload/[code]/[group]/route");
    const res = await POST(new NextRequest(`http://localhost/api/upload/${code}/a`, { method: "POST", headers: { "x-upload-key": key, "x-forwarded-for": "203.0.113.9" }, body: stream, duplex: "half" } as never), {
      params: Promise.resolve({ code, group: "a" }),
    });
    expect(res.status).toBe(413);
  });

  it("UTF-16으로 저장한 CSV도 읽는다", async () => {
    const { code, key } = setup();
    const text = csv(7601, teams(["가"]));
    const bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text.replace(/^﻿/, ""), "utf16le")]);
    expect((await upload(code, "a", key, bytes)).status).toBe(200);
    expect(t.loadView(code, null)!.groups[0].rounds[0].players[0].team).toBe("가");
  });

  it("키 하나는 1분에 10번까지 받고 그다음은 429", async () => {
    const { code, key } = setup(1, 12);
    const seen: number[] = [];
    for (let i = 0; i < 11; i++) seen.push((await upload(code, "a", key, csv(7700 + i, teams(["가"])))).status);
    expect(seen).toEqual([...Array(10).fill(200), 429]);
    const last = await upload(code, "a", key, csv(7799, teams(["가"])));
    expect(last).toMatchObject({ status: 429, retry: "60" });
    // 다른 키는 따로 셈
    const other = setup();
    expect((await upload(other.code, "a", other.key, csv(7798, teams(["가"])))).status).toBe(200);
  });

  it("한 IP에서 틀린 키를 계속 보내면 429", async () => {
    const { code } = setup();
    const seen = new Set<number>();
    for (let i = 0; i < 61; i++) seen.add((await upload(code, "a", "wrong", "x", { "x-forwarded-for": "203.0.113.50" })).status);
    expect([...seen]).toEqual([404, 429]);
  });
});
