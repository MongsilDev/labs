import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { derive, EARLY_S, writeDerived } from "../../scripts/er/tier/derive.mjs";

type P = Record<string, unknown>;

const tier = { patch: "12.7", views: [{ combos: [{ char: 6, weapon: 7, key: "Nadine", name: "나딘", weaponName: "활" }] }] };

function player(i: number, over: P = {}): P {
  return {
    matchingMode: 3, versionMajor: 7, versionMinor: 0, matchSize: 24, serverName: "Asia", startDtm: "2026-11-01T21:10:00.000+0900",
    characterNum: 6, bestWeapon: 7, gameRank: (i % 8) + 1, duration: 600 + i * 30, mmrBefore: 8500, mmrGain: 20 - (i % 8) * 10, mmrLossEntryCost: -65, teamKill: i % 20,
    ...over,
  };
}
const game = (t: number, players: P[]) => ({ t, body: brotliCompressSync(Buffer.from(JSON.stringify(players))) });
const full = (t: number, over: P = {}) => game(t, Array.from({ length: 24 }, (_, i) => player(i, over)));

describe("RP 손익, 초반과 막판 집계", () => {
  it("지금 패치의 아시아 랭크 경기만 센다", () => {
    const out = derive([full(1000), full(2000, { versionMajor: 6 }), full(3000, { serverName: "NorthAmerica" }), full(4000, { matchingMode: 2 }), full(5000, { matchSize: 12 })], tier);
    expect(out?.rp.games).toBe(1);
    expect(out?.rp.rows).toBe(24);
    expect([out?.rp.from, out?.rp.to]).toEqual([1000, 1000]);
  });

  it("RP 구간, 순위, 팀 처치 구간별로 평균을 낸다", () => {
    const out = derive(Array.from({ length: 20 }, (_, i) => full(1000 + i)), tier)!;
    const band = out.rp.bands.find((b) => b.lo === 8400)!;
    expect(band.n).toBe(480);
    expect(band.entry).toBe(-65);
    // 1위는 i가 0, 8, 16인 참가자라 팀 처치가 0, 8, 16
    expect(band.cells[0].map((c) => [c.n, c.m])).toEqual([[20, 20], [0, null], [20, 20], [0, null], [20, 20]]);
    expect(band.hours[21]).toMatchObject({ h: 21, n: 480 });
    expect(out.rp.bands.find((b) => b.lo === 7000)!.n).toBe(0);
  });

  it("표본이 모자란 조합과 이름을 모르는 조합은 초반과 막판에서 뺀다", () => {
    const games = Array.from({ length: 20 }, (_, i) => game(1000 + i, [...Array.from({ length: 20 }, (_, k) => player(k)), ...Array.from({ length: 4 }, (_, k) => player(k, { characterNum: 99 }))]));
    const late = derive(games, tier)!.late!;
    expect(late.cut).toBe(EARLY_S);
    expect(late.rows.map((r) => [r.key, r.n])).toEqual([["Nadine", 400]]);
    // 경기마다 4위 밖이고 780초 안에 끝난 참가자는 네 명, TOP3는 아홉 명이고 그중 1위가 셋
    const r = late.rows[0];
    expect(r.early).toBe(20);
    expect(r.top3).toBe(180);
    expect(r.fin).toBe(33.3);
  });

  it("해당 경기가 없으면 파일을 쓰지 않는다", () => {
    const dir = mkdtempSync(join(tmpdir(), "derive-"));
    expect(writeDerived(dir, derive([full(1000, { versionMajor: 6 })], tier))).toBe(false);
    expect(writeDerived(dir, derive([full(1000)], { ...tier, patch: null }))).toBe(false);
    expect(writeDerived(dir, derive(Array.from({ length: 20 }, (_, i) => full(1000 + i)), tier))).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "er-rp/rp.json"), "utf8")).games).toBe(20);
    expect(JSON.parse(readFileSync(join(dir, "er-late/late.json"), "utf8")).games).toBe(20);
  });

  it("조합 표본이 모자라면 RP 손익만 새로 쓰고 초반과 막판은 앞선 파일을 남긴다", () => {
    const dir = mkdtempSync(join(tmpdir(), "derive-"));
    writeDerived(dir, derive(Array.from({ length: 20 }, (_, i) => full(1000 + i)), tier));
    const out = derive([full(9000)], tier);
    expect(out?.late).toBeNull();
    expect(writeDerived(dir, out)).toBe(true);
    expect(JSON.parse(readFileSync(join(dir, "er-rp/rp.json"), "utf8")).games).toBe(1);
    expect(JSON.parse(readFileSync(join(dir, "er-late/late.json"), "utf8")).games).toBe(20);
  });
});
