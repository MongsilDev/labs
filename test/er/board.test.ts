import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { csv } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-board-"));
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const owner = { id: "11", name: "개최자", avatar: null };
const teams = (order: string[]) => order.map((team, i) => ({ team, place: i + 1, ks: i === 0 ? 3 : 1 }));

let b: typeof import("../../src/er/server/board");
let t: typeof import("../../src/er/server/tournament");

beforeAll(async () => {
  const db = await import("../../src/er/server/db");
  t = await import("../../src/er/server/tournament");
  b = await import("../../src/er/server/board");
  db.db().prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(owner.id, owner.name, Date.now());
});

describe("몽실봇 순위 API", () => {
  it("토큰이 정확히 같을 때만 통과한다", () => {
    process.env.LABS_BOT_TOKEN = "a".repeat(64);
    expect(b.botAuthorized("a".repeat(64))).toBe(true);
    expect(b.botAuthorized("a".repeat(63))).toBe(false);
    expect(b.botAuthorized(null)).toBe(false);
    delete process.env.LABS_BOT_TOKEN;
    expect(b.botAuthorized("")).toBe(false);
  });

  it("예시 대회는 계산된 순위와 한국어 금지 실험체를 준다", () => {
    const r = b.botBoard("example", null, null);
    if (!r || r === "no-group") throw new Error("예시 없음");
    expect(r.code).toBe("EXAMPLE");
    expect(r.url).toMatch(/\/er\/example\/a$/);
    expect(r.ended).toBe(true);
    expect(r.standings[0]).toMatchObject({ rank: 1, name: "인천 웨이브", total: 105, fixed: 1 });
    expect(r.next).toBeNull();
    expect(r.replays).toEqual([]);
    expect(b.botBoard("EXAMPLE", "B", null)).toBe("no-group");
  });

  it("조와 역할, 다음 라운드를 대회 화면과 같은 기준으로 준다", () => {
    const code = t.createTournament(owner, { name: "봇 시험", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 2 });
    t.applyOp(code, owner, { op: "add_csv", group: 1, files: [{ name: "a.csv", text: csv(10, teams(["가", "나", "다"])) }] });
    const r = b.botBoard(code.toLowerCase(), "b", owner.id);
    if (!r || r === "no-group") throw new Error("대회 없음");
    expect(r).toMatchObject({ group: "B", groups: ["A", "B"], played: 1, ended: false, role: "owner" });
    expect(r.url).toMatch(new RegExp(`/er/t/${code}/b$`));
    expect(r.standings.map((s) => [s.rank, s.name, s.total])).toEqual([[1, "가", 13], [2, "나", 8], [3, "다", 6]]);
    expect(r.next?.roundNo).toBe(2);
    expect(r.replays).toEqual([{ roundNo: 1, gameId: 10 }]);
    const anon = b.botBoard(code, "B", "999");
    expect(anon && anon !== "no-group" && anon.role).toBeNull();
    expect(b.boardVersion(code)).toBe(r.version);
    expect(b.botBoard("ZZZZZZ", null, null)).toBeNull();
  });

  it("디스코드 ID로 그 사람이 맡은 대회만 준다", () => {
    const list = b.botTournaments(owner.id);
    expect(list[0]).toEqual({ code: expect.any(String), name: "봇 시험", role: "owner", played: 1 });
    expect(b.botTournaments("999")).toEqual([]);
    expect(b.botTournaments("abc")).toEqual([]);
  });

  it("리플레이 코드는 게임 ID가 있는 CSV 라운드만 라운드 순서대로 준다", () => {
    const code = t.createTournament(owner, { name: "리플레이 시험", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 1 });
    t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "c.csv", text: csv(30, teams(["가", "나"])) }], round: 3 });
    t.applyOp(code, owner, { op: "add_manual", group: 0, round: 2, teams: [{ team: "가", placement: 1, killScore: 0 }, { team: "나", placement: 2, killScore: 0 }] });
    t.applyOp(code, owner, { op: "add_csv", group: 0, files: [{ name: "a.csv", text: csv(10, teams(["가", "나"])) }], round: 1 });
    const r = b.botBoard(code, null, owner.id);
    if (!r || r === "no-group") throw new Error("대회 없음");
    expect(r.replays).toEqual([{ roundNo: 1, gameId: 10 }, { roundNo: 3, gameId: 30 }]);
  });
});
