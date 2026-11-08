import { describe, expect, it } from "vitest";
import type { CardRead } from "@/er/lib/hud";
import { liveRows, outPlace, parseFrame, suggestTeams, type LiveTeam } from "@/er/lib/live";
import { applyRead, emptySlots, fixSlot, unfixAll } from "@/er/lib/live-read";

const team = (slot: number, p: Partial<LiveTeam> = {}): LiveTeam => ({ slot, teamId: null, name: null, ts: null, ks: null, out: false, place: null, fixed: false, ...p });
const cards = (list: Partial<CardRead>[]): CardRead[] => list.map((c, i) => ({ slot: i + 1, ts: null, ks: null, raised: false, out: false, ...c }));

describe("경기 중 값", () => {
  it("모양이 다른 본문은 버림", () => {
    expect(parseFrame({ roundNo: 2, teams: [team(1, { ts: 3.5 })] })?.teams[0].ts).toBe(3.5);
    expect(parseFrame({ roundNo: 0, teams: [] })).toBeNull();
    expect(parseFrame({ roundNo: 1, teams: [team(1), team(1)] })).toBeNull();
    expect(parseFrame({ roundNo: 1, teams: [team(9)] })).toBeNull();
    expect(parseFrame({ roundNo: 1, teams: Array.from({ length: 9 }, (_, i) => team(i + 1)) })).toBeNull();
    expect(parseFrame({ roundNo: 1, teams: [team(1, { ts: -1, name: "  가\u0000나  " })] })?.teams[0]).toMatchObject({ ts: null, name: "가나" });
  });

  it("탈락 순위는 TS에서 KS를 뺀 순위 점수로 정함", () => {
    expect(outPlace(4.5, 4.5, 8)).toBe(8);
    expect(outPlace(22.5, 17.5, 3)).toBe(3);
    expect(outPlace(12.5, 5.5, 2)).toBe(2);
    expect(outPlace(null, null, 5)).toBe(5);
    expect(outPlace(9, 2.5, 4)).toBe(4);
  });

  it("누적에 이번 라운드 TS를 더하고 다시 정렬", () => {
    const standings = [
      { key: "a", name: "GNS", total: 60.5 },
      { key: "b", name: "DG", total: 35.5 },
      { key: "c", name: "DTS", total: 34 },
    ];
    const frame = { roundNo: 4, at: 0, teams: [team(1, { teamId: "a", ts: 1 }), team(2, { teamId: "b", ts: 1, out: true, place: 8 }), team(3, { teamId: "c", ts: 3 })] };
    const { rows, live } = liveRows(standings, frame, 3);
    expect(live).toBe(true);
    expect(rows.map((r) => [r.name, r.total, r.rank])).toEqual([
      ["GNS", 61.5, 1],
      ["DTS", 37, 2],
      ["DG", 36.5, 3],
    ]);
    expect(rows[2]).toMatchObject({ out: true, place: 8, ts: 1 });
  });

  it("확정 기록이 그 라운드를 담으면 누적만 보여 줌", () => {
    const frame = { roundNo: 4, at: 0, teams: [team(1, { teamId: "a", ts: 5 })] };
    const { rows, live } = liveRows([{ key: "a", name: "A", total: 10 }], frame, 4);
    expect(live).toBe(false);
    expect(rows[0]).toMatchObject({ total: 10, ts: null });
  });

  it("연결하지 않은 카드는 적은 이름이나 번호로 줄을 만들고, 같은 점수는 같은 순위", () => {
    const frame = { roundNo: 1, at: 0, teams: [team(1, { name: "몽실", ts: 2 }), team(2, { ts: 2 }), team(3)] };
    const { rows } = liveRows([], frame, 0);
    expect(rows.map((r) => [r.name, r.rank])).toEqual([
      ["몽실", 1],
      ["2번 팀", 1],
    ]);
  });

  it("최근 라운드의 Team N 이름으로 카드 번호를 제안", () => {
    const s = [
      { key: "x", bases: [{ round: 1, base: "1R Team 3" }, { round: 2, base: "2R Team 5" }] },
      { key: "y", bases: [{ round: 2, base: "2R 몽실" }] },
    ];
    expect(suggestTeams(s)).toEqual({ 5: "x" });
  });
});

describe("읽기 탭 카드", () => {
  it("같은 값을 두 번 연속 읽어야 바꿈", () => {
    let s = emptySlots();
    s = applyRead(s, cards([{ ts: 3, ks: 2 }]));
    expect(s[0].ts).toBeNull();
    s = applyRead(s, cards([{ ts: 3, ks: 2 }]));
    expect(s[0]).toMatchObject({ ts: 3, ks: 2, warn: false });
    s = applyRead(s, cards([{ ts: 8, ks: 2 }]));
    s = applyRead(s, cards([{ ts: 6, ks: 2 }]));
    expect(s[0]).toMatchObject({ ts: 3, warn: true });
  });

  it("못 읽은 장면은 마지막 값을 유지", () => {
    let s = emptySlots();
    s = applyRead(applyRead(s, cards([{ ts: 3, ks: 2 }])), cards([{ ts: 3, ks: 2 }]));
    s = applyRead(s, cards([{}]));
    expect(s[0].ts).toBe(3);
  });

  it("다른 카드는 읽히는데 한 카드만 3번 연속 못 읽으면 확인 표시", () => {
    let s = emptySlots();
    s = applyRead(applyRead(s, cards([{ ts: 3, ks: 2 }, { ts: 1, ks: 1 }])), cards([{ ts: 3, ks: 2 }, { ts: 1, ks: 1 }]));
    for (let i = 0; i < 2; i++) s = applyRead(s, cards([{}, { ts: 1, ks: 1 }]));
    expect(s[0]).toMatchObject({ ts: 3, warn: false });
    s = applyRead(s, cards([{}, { ts: 1, ks: 1 }]));
    expect(s[0]).toMatchObject({ ts: 3, warn: true });
    s = applyRead(s, cards([{ ts: 3, ks: 2 }, { ts: 1, ks: 1 }]));
    expect(s[0].warn).toBe(false);
    for (let i = 0; i < 5; i++) s = applyRead(s, cards([{}, {}]));
    expect(s[0].warn).toBe(false);
  });

  it("탈락은 두 번 연속 보일 때 표시하고 순위 점수로 순위를 정함", () => {
    let s = emptySlots();
    s = applyRead(applyRead(s, cards([{ ts: 4.5, ks: 4.5 }])), cards([{ ts: 4.5, ks: 4.5 }]));
    s = applyRead(s, cards([{ ts: 4.5, ks: 4.5, out: true }]));
    expect(s[0].out).toBe(false);
    s = applyRead(s, cards([{ ts: 4.5, ks: 4.5, out: true }]));
    expect(s[0]).toMatchObject({ out: true, place: 8 });
    s = applyRead(s, cards([{ ts: 4.5, ks: 4.5 }]));
    expect(s[0].out).toBe(true);
  });

  it("고친 카드는 읽은 값으로 바뀌지 않고, 풀면 다시 읽음", () => {
    let s = fixSlot(emptySlots(), 1, { ts: 7 });
    s = applyRead(applyRead(s, cards([{ ts: 3, ks: 2 }])), cards([{ ts: 3, ks: 2 }]));
    expect(s[0]).toMatchObject({ ts: 7, fixed: true });
    s = unfixAll(s);
    s = applyRead(applyRead(s, cards([{ ts: 3, ks: 2 }])), cards([{ ts: 3, ks: 2 }]));
    expect(s[0].ts).toBe(3);
  });
});
