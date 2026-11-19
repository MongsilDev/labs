import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import zlib from "node:zlib";
import { afterAll, describe, expect, it } from "vitest";
import { loadRace, raceBoard, recordHist, scanArchive, scanGame } from "../../scripts/er/tier/race.mjs";

const user = (nickname: string, before: number, after: number, o: Record<string, unknown> = {}) => ({
  nickname,
  mmrBefore: before,
  mmrAfter: after,
  serverName: "Asia",
  matchingMode: 3,
  startDtm: "2026-11-19T15:00:00.000+0900",
  duration: 1200,
  ...o,
});
const END = Date.UTC(2026, 10, 19, 6, 20);

describe("scanGame", () => {
  it("8,300을 넘은 경기의 종료 시각을 남긴다", () => {
    const s = loadRace("/nonexistent", 43);
    scanGame(s, { userGames: [user("a", 8250, 8310), user("b", 8200, 8290), user("c", 8300, 8350)] });
    expect(s.reached).toEqual({ a: END });
  });
  it("다른 서버, 일반 게임은 세지 않는다", () => {
    const s = loadRace("/nonexistent", 43);
    scanGame(s, { userGames: [user("a", 8250, 8310, { serverName: "Asia2" }), user("b", 8250, 8310, { matchingMode: 2 })] });
    expect(s.reached).toEqual({});
  });
  it("떨어졌다가 다시 넘어도 처음 시각을 유지한다", () => {
    const s = loadRace("/nonexistent", 43);
    scanGame(s, { userGames: [user("a", 8250, 8310, { startDtm: "2026-11-19T18:00:00.000+0900" })] });
    scanGame(s, { userGames: [user("a", 8250, 8310)] });
    expect(s.reached.a).toBe(END);
  });
});

describe("scanArchive", () => {
  const dir = mkdtempSync(join(tmpdir(), "race-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, "games.sqlite");
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE games (game INTEGER PRIMARY KEY, t INTEGER, season INTEGER, mode INTEGER, n INTEGER, body BLOB);
    CREATE TABLE state (k TEXT PRIMARY KEY, v INTEGER); CREATE TABLE miss (id INTEGER PRIMARY KEY, n INTEGER)`);
  const put = (game: number, season: number, users: object[]) =>
    db.prepare(`INSERT INTO games VALUES (?, 0, ?, 3, ?, ?)`).run(game, season, users.length, zlib.brotliCompressSync(JSON.stringify({ userGames: users })));
  const cursor = (v: number) => db.prepare(`INSERT INTO state VALUES ('cursor', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).run(v);

  it("시즌 경기만 읽고, 받지 못한 번호는 채워지면 다음 회차에 읽는다", () => {
    put(10, 42, [user("old", 8000, 8400)]);
    put(11, 43, [user("a", 8250, 8310)]);
    db.prepare(`INSERT INTO miss VALUES (12, 1)`).run();
    put(13, 43, []);
    cursor(13);
    const s = loadRace("/nonexistent", 43);
    expect(scanArchive(s, file)).toBe(2);
    expect(s).toMatchObject({ base: 10, cursor: 13, pending: [12] });
    expect(Object.keys(s.reached)).toEqual(["a"]);

    put(12, 43, [user("b", 8250, 8300)]);
    db.prepare(`DELETE FROM miss WHERE id = 12`).run();
    put(14, 43, [user("c", 8250, 8300)]);
    cursor(14);
    expect(scanArchive(s, file)).toBe(2);
    expect(s).toMatchObject({ cursor: 14, pending: [] });
    expect(Object.keys(s.reached).sort()).toEqual(["a", "b", "c"]);
  });
  it("커서가 없는 기록에서도 24시간 기록은 이어 받는다", () => {
    const f = join(dir, "state.json");
    writeFileSync(f, JSON.stringify({ season: 43, cursor: null, hist: [[1, { a: 1 }]] }));
    expect(loadRace(f, 43)).toMatchObject({ cursor: null, hist: [[1, { a: 1 }]] });
    expect(loadRace(f, 44).hist).toEqual([]);
  });
  it("보관기가 없으면 null", () => {
    expect(scanArchive(loadRace("/nonexistent", 43), join(dir, "none.sqlite"))).toBeNull();
  });
});

describe("raceBoard", () => {
  const s = { ...loadRace("/nonexistent", 43), reached: { b: END, a: END + 60_000, e: END + 120_000 } };
  it("도달한 계정을 도달 순서로, 그 뒤에 못 닿은 계정을 RP순으로", () => {
    const top = [
      { nickname: "a", mmr: 8500, rank: 1 },
      { nickname: "c", mmr: 8320, rank: 3 },
      { nickname: "b", mmr: 8310, rank: 2 },
      { nickname: "e", mmr: 8250, rank: 4 },
      { nickname: "d", mmr: 8100, rank: 5 },
      { nickname: "f", mmr: 8200, rank: 6 },
    ];
    const r = raceBoard(s, { seasonId: 43, top, now: 1_000.4 });
    expect(r).toMatchObject({ updatedAt: 1000, season: 43, open: true, count: 4 });
    expect(r.list.map((x: { nickname: string }) => x.nickname)).toEqual(["b", "a", "e", "c", "f", "d"]);
    expect(r.list[0]).toEqual({ nickname: "b", rp: 8310, at: END / 1000, gain: null });
    expect(r.list[3].at).toBeNull();
  });
  it("못 닿은 계정까지 10명만", () => {
    const top = Array.from({ length: 30 }, (_, i) => ({ nickname: `p${i}`, mmr: 7000 - i, rank: i + 1 }));
    const r = raceBoard(s, { seasonId: 43, top, now: 0 });
    expect(r).toMatchObject({ count: 0 });
    expect(r.list.map((x: { nickname: string }) => x.nickname)).toEqual(Array.from({ length: 10 }, (_, i) => `p${i}`));
  });
  it("24시간 변화는 20~28시간 전 기록 가운데 24시간에 가장 가까운 것과 비교", () => {
    const h = { ...loadRace("/nonexistent", 43) };
    const H = 3600;
    recordHist(h, [{ nickname: "x", mmr: 7000 }], 0);
    recordHist(h, [{ nickname: "x", mmr: 7100 }, { nickname: "y", mmr: 6000 }], 3 * H);
    recordHist(h, [{ nickname: "x", mmr: 7200 }], 3 * H + 60);
    expect(h.hist).toHaveLength(2);
    const r = raceBoard(h, { seasonId: 43, top: [{ nickname: "x", mmr: 7500 }, { nickname: "y", mmr: 6100 }, { nickname: "z", mmr: 6000 }], now: 27 * H });
    expect(r.list.map((x: { gain: number | null }) => x.gain)).toEqual([400, 100, null]);
    recordHist(h, [], 40 * H);
    expect(h.hist.map((x: [number]) => x[0])).toEqual([40 * H]);
  });
  it("300위가 8,300을 넘으면 닫고 목록을 비운다", () => {
    const top = Array.from({ length: 300 }, (_, i) => ({ nickname: `p${i}`, mmr: 9000 - i, rank: i + 1 }));
    expect(raceBoard(s, { seasonId: 43, top, now: 0 })).toMatchObject({ open: false, count: 300, list: [] });
    top[299].mmr = 8300;
    expect(raceBoard(s, { seasonId: 43, top, now: 0 }).open).toBe(true);
  });
  it("빈 순위표는 열려 있고 0명", () => {
    expect(raceBoard(s, { seasonId: 43, top: [], now: 0 })).toMatchObject({ open: true, count: 0, list: [] });
  });
});
