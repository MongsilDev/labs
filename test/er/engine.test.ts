import { describe, expect, it } from "vitest";
import { computeGroup, type GroupInput } from "../../src/er/lib/engine";
import { parseRoundCsv } from "../../src/er/lib/parse";
import { standingsCsv } from "../../src/er/lib/export";
import { clampRules, presetRules, type Mode } from "../../src/er/lib/rules";
import { csv, places, round } from "./helpers";

const T = ["알파", "브라보", "찰리", "델타", "에코", "폭스", "골프", "호텔"];

function group(over: Partial<GroupInput> = {}, mode: Mode = "points"): GroupInput {
  return {
    mode,
    rules: presetRules("masters"),
    plannedRounds: 4,
    rounds: [],
    penalties: [],
    weather: [],
    aliases: {},
    overrides: {},
    ...over,
  };
}

const names = (g: GroupInput) => computeGroup(g).standings.map((s) => s.name);

describe("CSV 해석", () => {
  it("BOM과 쉼표 뒤 공백이 있는 실제 내보내기 형식을 읽는다", () => {
    const r = parseRoundCsv(csv(12345678, [{ team: "가나 다라", place: 1, ks: 10.5, players: [{ nick: "가", char: "Rio", kill: 6, hunting: 69, level: 20 }] }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.round.gameId).toBe(12345678);
    expect(r.round.players[0]).toMatchObject({ team: "가나 다라", character: "Rio", nickname: "가", placement: 1, totalScore: 20.5, killScore: 10.5, kills: 6, hunting: 69, level: 20 });
  });

  it("필수 열이 없으면 이유를 알려 준다", () => {
    expect(parseRoundCsv("teamName,gameId\nA,1\n")).toEqual({ ok: false, error: "이터널 리턴 결과 CSV가 아닙니다. 없는 열: tournament total score, tournament kill score" });
    expect(parseRoundCsv("")).toEqual({ ok: false, error: "경기 기록이 없는 파일입니다." });
  });

  it("96줄이 넘는 파일은 경기 기록으로 받지 않는다", () => {
    const rows = (n: number) => csv(1, [{ team: "가", place: 1, ks: 0, players: Array.from({ length: n }, (_, i) => ({ nick: `p${i}` })) }]);
    expect(parseRoundCsv(rows(96)).ok).toBe(true);
    expect(parseRoundCsv(rows(97))).toEqual({ ok: false, error: "한 경기 기록은 96줄까지 올릴 수 있습니다." });
  });
});

describe("선수 순위", () => {
  it("평균 킬이 같으면 같은 순위이고 다음 순위는 같은 선수 수만큼 건너뛴다", () => {
    const r1 = round(1, 1, [
      { team: "Alpha", place: 1, ks: 0, players: [{ nick: "a", kill: 5 }, { nick: "b", kill: 3 }, { nick: "c", kill: 3 }] },
      { team: "Beta", place: 2, ks: 0, players: [{ nick: "d", kill: 1 }] },
    ]);
    expect(computeGroup(group({ rounds: [r1] })).players.map((p) => [p.nickname, p.rank])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ]);
  });
});

describe("포인트제", () => {
  it("라운드 점수를 더하고 총점 순으로 정렬한다", () => {
    const g = group({ rounds: [places(1, T, [5, 4, 3, 2, 1, 0, 0, 0]), places(2, [...T].reverse())] });
    const res = computeGroup(g);
    expect(res.standings[0]).toMatchObject({ name: "알파", total: 15, killScore: 5 });
    expect(res.played).toBe(2);
    expect(res.next?.roundNo).toBe(3);
  });

  it("총점이 같으면 킬 점수, 그다음 마지막 라운드 순위로 가른다", () => {
    const r1 = round(1, 1, [{ team: "A", place: 1, ks: 2 }, { team: "B", place: 2, ks: 5 }]);
    const r2 = round(2, 2, [{ team: "B", place: 2, ks: 0 }, { team: "A", place: 1, ks: 0 }]);
    const res = computeGroup(group({ rounds: [r1, r2] }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["A", 22], ["B", 19]]);

    const t1 = round(1, 1, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 2, ks: 3 }]);
    const tie = computeGroup(group({ rounds: [t1] }));
    expect(tie.standings.map((s) => s.name)).toEqual(["B", "A"]);
    expect(tie.standings[1].tiedBy).toBe("killScore");

    const k1 = round(1, 1, [{ team: "A", place: 2, ks: 3 }, { team: "B", place: 1, ks: 0 }]);
    const k2 = round(2, 2, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 2, ks: 3 }]);
    const byKs = computeGroup(group({ rounds: [k1, k2] }));
    expect(byKs.standings.map((s) => s.name)).toEqual(["A", "B"]);
    expect(byKs.standings[1].tiedBy).toBe("lastPlacement");
  });

  it("정한 라운드를 모두 치르면 끝난다", () => {
    const res = computeGroup(group({ plannedRounds: 2, rounds: [places(1, T), places(2, T)] }));
    expect(res.ended).toBe(true);
    expect(res.next).toBeNull();
  });

  it("순위 변동을 직전 라운드와 비교한다", () => {
    const res = computeGroup(group({ rounds: [places(1, ["A", "B", "C"]), places(2, ["C", "B", "A"], [0, 0, 0])] }));
    const delta = Object.fromEntries(res.standings.map((s) => [s.name, s.delta]));
    expect(delta).toEqual({ C: 2, A: -1, B: -1 });
  });
});

describe("감점", () => {
  it("처치자 불명 사망은 1회 1점, 규정 위반은 입력한 점수를 뺀다", () => {
    const res = computeGroup(
      group({
        rounds: [places(1, ["A", "B"])],
        penalties: [
          { id: 1, team: "A", roundNo: 1, kind: "death", count: 2, points: 0, reason: "처치자 불명 사망" },
          { id: 2, team: "A", roundNo: 1, kind: "rule", count: 1, points: 5, reason: "지각" },
        ],
      }),
    );
    const a = res.standings.find((s) => s.name === "A")!;
    expect(a).toMatchObject({ roundScore: 10, penalty: 7, total: 3 });
  });

  it("처치자 불명 감점을 끄면 사망 감점은 무시한다", () => {
    const rules = { ...presetRules("masters"), deathPenalty: false };
    const res = computeGroup(group({ rules, rounds: [places(1, ["A"])], penalties: [{ id: 1, team: "A", roundNo: 1, kind: "death", count: 3, points: 0, reason: "" }] }));
    expect(res.standings[0].total).toBe(10);
  });
});

describe("점수 규칙", () => {
  it("직접 입력이면 순위 점수표와 킬 점수 배율로 다시 계산한다", () => {
    const rules = { ...presetRules("custom"), placementPoints: [8, 5, 4, 3, 2, 1, 0, 0], killMultiplier: 2 };
    const res = computeGroup(group({ rules, rounds: [round(1, 1, [{ team: "A", place: 1, ks: 3 }, { team: "B", place: 9, ks: 1 }])] }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["A", 14], ["B", 2]]);
  });

  it("CSV 없이 직접 입력한 라운드는 순위 점수표로 계산한다", () => {
    const manual = {
      roundNo: 1,
      source: "manual" as const,
      gameId: null,
      players: [
        { nickname: "", character: "", team: "A", placement: 2, totalScore: 0, killScore: 4, kills: 0, teamKills: 0, hunting: 0, level: 0 },
      ],
    };
    expect(computeGroup(group({ rounds: [manual] })).standings[0].total).toBe(11);
  });

  it("킬 수 기준 동점 처리를 고를 수 있다", () => {
    const rules = { ...presetRules("masters"), tiebreak: "kills" as const };
    const r1 = round(1, 1, [{ team: "A", place: 2, ks: 3, kills: 3 }, { team: "B", place: 1, ks: 0, kills: 9 }]);
    const r2 = round(2, 2, [{ team: "A", place: 1, ks: 0, kills: 0 }, { team: "B", place: 2, ks: 3, kills: 0 }]);
    expect(names(group({ rules, rounds: [r1, r2] }))).toEqual(["B", "A"]);
  });
});

describe("점검에서 찾은 경우", () => {
  it("중간 라운드가 비어 있으면 끝나지 않고 빈 라운드가 다음 경기다", () => {
    const res = computeGroup(group({ plannedRounds: 4, rounds: [places(1, T), places(2, T), places(4, T)] }));
    expect(res.ended).toBe(false);
    expect(res.next?.roundNo).toBe(3);
  });

  it("동점 표시는 위아래 어느 쪽이 동점이어도 붙는다", () => {
    const r1 = round(1, 1, [{ team: "A", place: 1, ks: 0 }, { team: "C", place: 2, ks: 0 }, { team: "B", place: 4, ks: 3 }]);
    const res = computeGroup(group({ rounds: [r1] }));
    expect(res.standings.map((s) => [s.name, s.tiedBy])).toEqual([["A", null], ["B", "killScore"], ["C", "killScore"]]);
  });

  it("감점 예외는 직전 라운드의 규정 위반 감점에만 적용된다", () => {
    const four = [0, 1, 2, 3].map((i) => places(i + 1, T));
    const old = [{ id: 1, team: "브라보", roundNo: 2, kind: "rule" as const, count: 1, points: 30, reason: "지각" }];
    const res = computeGroup(group({ plannedRounds: 12, rounds: four, penalties: old }, "checkpoint"));
    expect(res.next?.checkpoint).toEqual(["알파", "찰리"]);
  });
});

describe("재점검에서 찾은 경우", () => {
  const ps = (...n: string[]) => n.map((nick) => ({ nick }));

  it("기본 팀명의 기준 이름은 앞 라운드 CSV가 나중에 올라와도 바뀌지 않는다", () => {
    const r2 = round(2, 2, [{ team: "Team 3", place: 1, ks: 0, players: ps("a", "b", "c") }, { team: "Other", place: 2, ks: 0, players: ps("x1", "x2", "x3") }]);
    const extra = {
      penalties: [{ id: 1, team: "2R Team 3", roundNo: 2, kind: "rule" as const, count: 1, points: 3, reason: "지각" }],
      aliases: { "2R Team 3": "우리팀" },
    };
    const before = computeGroup(group({ rounds: [r2], ...extra }));
    expect(before.standings.find((s) => s.name === "우리팀")).toMatchObject({ total: 7, penalty: 3 });
    const r1 = round(1, 1, [{ team: "Team 7", place: 1, ks: 0, players: ps("a", "b", "z") }]);
    const r3 = round(3, 3, [{ team: "Delta", place: 1, ks: 0, players: ps("a", "b", "y") }]);
    const after = computeGroup(group({ rounds: [r1, r2, r3], ...extra }));
    expect(after.standings.map((s) => [s.name, s.total])).toEqual([["우리팀", 27], ["Other", 7]]);
    expect(after.standings[0].penalty).toBe(3);
  });

  it("연쇄로 겹쳐도 같은 라운드의 두 팀은 한 팀이 되지 않는다", () => {
    const r1 = round(1, 1, [{ team: "Team 1", place: 1, ks: 0, players: ps("a", "b", "c") }, { team: "Team 2", place: 2, ks: 0, players: ps("d", "e", "f") }]);
    const r2 = round(2, 2, [{ team: "Team 4", place: 1, ks: 0, players: ps("a", "b", "d") }, { team: "Team 6", place: 2, ks: 0, players: ps("c", "e", "f") }]);
    const r3 = round(3, 3, [{ team: "Team 8", place: 1, ks: 0, players: ps("b", "d", "e") }]);
    const res = computeGroup(group({ rounds: [r1, r2, r3] }));
    expect(res.rounds.map((r) => r.teamCount)).toEqual([2, 2, 1]);
    const totals = res.standings.reduce((a, s) => a + s.roundScore, 0);
    expect(totals).toBe(10 + 7 + 10 + 7 + 10);
  });

  it("직접 입력한 같은 기본 팀명은 같은 팀이다", () => {
    const manual = (roundNo: number, placement: number) => ({
      roundNo,
      source: "manual" as const,
      gameId: null,
      players: [{ nickname: "", character: "", team: "Team 3", placement, totalScore: 0, killScore: 0, kills: 0, teamKills: 0, hunting: 0, level: 0 }],
    });
    const res = computeGroup(group({ rounds: [manual(1, 1), manual(2, 2)] }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["Team 3", 17]]);
  });

  it("합친 팀의 이름을 바꿔도 합친 상태가 유지된다", () => {
    const rounds = [places(1, ["Alpha", "X"]), places(2, ["Bravo", "X"])];
    const res = computeGroup(group({ rounds, aliases: { Bravo: "Alpha", Alpha: "Zulu" } }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["Zulu", 20], ["X", 14]]);
  });

  it("직접 입력에 기준 이름을 그대로 쓰면 원래 팀에 이어 붙는다", () => {
    const r1 = round(1, 1, [{ team: "Team 3", place: 2, ks: 0, players: ps("a", "b", "c") }]);
    const m2 = {
      roundNo: 2,
      source: "manual" as const,
      gameId: null,
      players: [{ nickname: "", character: "", team: "1R Team 3", placement: 1, totalScore: 0, killScore: 0, kills: 0, teamKills: 0, hunting: 0, level: 0 }],
    };
    const r3 = round(3, 3, [{ team: "Delta", place: 1, ks: 0, players: ps("a", "b", "z") }]);
    const extra = { penalties: [{ id: 1, team: "1R Team 3", roundNo: 2, kind: "rule" as const, count: 1, points: 2, reason: "지각" }] };
    const res = computeGroup(group({ rounds: [r1, m2, r3], ...extra }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["Delta", 25]]);
    expect(res.orphanPenalties).toEqual([]);
  });

  it("다른 라운드 기록을 지워도 그 라운드 기록에 건 감점은 남고, 기록이 없으면 팀 없음으로 따로 둔다", () => {
    const r1 = round(1, 1, [{ team: "Team 3", place: 1, ks: 0, players: ps("a", "b", "c") }]);
    const r2 = round(2, 2, [{ team: "Team 5", place: 1, ks: 0, players: ps("a", "b", "c") }]);
    const extra = {
      penalties: [
        { id: 1, team: "2R Team 5", roundNo: 2, kind: "rule" as const, count: 1, points: 2, reason: "지각" },
        { id: 2, team: "1R Team 3", roundNo: 1, kind: "rule" as const, count: 1, points: 1, reason: "지각" },
      ],
      aliases: { "1R Team 3": "우리팀", "2R Team 5": "우리팀" },
    };
    const both = computeGroup(group({ rounds: [r1, r2], ...extra }));
    expect(both.standings.map((s) => [s.name, s.total, s.bases.length])).toEqual([["우리팀", 17, 2]]);
    const only2 = computeGroup(group({ rounds: [r2], ...extra }));
    expect(only2.standings.map((s) => [s.name, s.total])).toEqual([["우리팀", 7]]);
    expect(only2.orphanPenalties).toEqual([]);
    const plain = computeGroup(group({ rounds: [r2], penalties: extra.penalties }));
    expect(plain.standings.map((s) => [s.name, s.total])).toEqual([["2R Team 5", 8]]);
    expect(plain.orphanPenalties).toEqual([2]);
  });

  it("빈 라운드가 있으면 그 라운드 시작 기준으로 체크포인트를 보여 준다", () => {
    const rules = presetRules("masters");
    rules.checkpoint = { ...rules.checkpoint, type: "points", points: 15 };
    const r1 = round(1, 1, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 2, ks: 0 }]);
    const r3 = round(3, 3, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 2, ks: 3 }]);
    const res = computeGroup(group({ rules, plannedRounds: 12, rounds: [r1, r3] }, "checkpoint"));
    expect(res.next?.roundNo).toBe(2);
    expect(res.next?.checkpoint).toEqual([]);
  });
});

describe("메인 날씨 선택권", () => {
  it("체크포인트 팀 중 점수가 가장 높은 팀이 다음 라운드 메인 날씨를 고른다", () => {
    const rules = presetRules("masters");
    rules.checkpoint = { ...rules.checkpoint, type: "points", points: 15 };
    const r1 = round(1, 1, [{ team: "A", place: 1, ks: 8 }, { team: "B", place: 2, ks: 9 }, { team: "C", place: 3, ks: 0 }]);
    const res = computeGroup(group({ rules, plannedRounds: 12, rounds: [r1] }, "checkpoint"));
    expect(res.next?.checkpoint).toEqual(["A", "B"]);
    expect(res.next?.weatherPick).toBe("A");
    const pts = computeGroup(group({ rounds: [r1] }));
    expect(pts.next?.weatherPick).toBeNull();
  });
});

describe("다른 동점 기준", () => {
  const r1 = round(1, 1, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 3, ks: 5 }]);
  const r2 = round(2, 2, [{ team: "A", place: 4, ks: 1 }, { team: "B", place: 2, ks: 0 }]);
  it("배틀그라운드식 순위 점수 합 기준", () => {
    const rules = { ...presetRules("masters"), tiebreak: "rankScore" as const };
    const res = computeGroup(group({ rules, rounds: [r1, r2] }));
    expect(res.standings.map((s) => [s.name, s.total, s.rankScore])).toEqual([["A", 15, 14], ["B", 17, 12]].sort((a, b) => (b[1] as number) - (a[1] as number)));
  });
  it("포트나이트식 1위 횟수 기준과 순위 점수, 1위 횟수 집계", () => {
    const a1 = round(1, 1, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 2, ks: 3 }]);
    const a2 = round(2, 2, [{ team: "A", place: 2, ks: 0 }, { team: "B", place: 1, ks: 0 }, { team: "C", place: 3, ks: 0 }]);
    const a3 = round(3, 3, [{ team: "C", place: 1, ks: 0 }, { team: "A", place: 3, ks: 0 }, { team: "B", place: 8, ks: 0 }]);
    const rules = { ...presetRules("masters"), tiebreak: "wins" as const };
    const res = computeGroup(group({ rules, rounds: [a1, a2, a3] }));
    const a = res.standings.find((s) => s.name === "A")!;
    expect(a).toMatchObject({ total: 22, rankScore: 22, wins: 1 });
    const b = res.standings.find((s) => s.name === "B")!;
    expect(b).toMatchObject({ total: 20, rankScore: 17, wins: 1, killScore: 3 });
  });
  it("총점과 1위 횟수가 같으면 다음 기준으로 넘어간다", () => {
    const t1 = round(1, 1, [{ team: "A", place: 1, ks: 0 }, { team: "B", place: 2, ks: 3 }]);
    const t2 = round(2, 2, [{ team: "B", place: 1, ks: 0 }, { team: "A", place: 2, ks: 3 }]);
    const rules = { ...presetRules("masters"), tiebreak: "wins" as const };
    const res = computeGroup(group({ rules, rounds: [t1, t2] }));
    expect(res.standings.map((s) => s.name)).toEqual(["B", "A"]);
    expect(res.standings[1].tiedBy).toBe("lastPlacement");
  });
});

describe("팀 이름", () => {
  it("기본 팀명은 앞 라운드와 닉네임이 2명 이상 겹치는 팀으로 이어진다", () => {
    const p = (team: string) => [1, 2, 3].map((i) => ({ nick: `${team}${i}` }));
    const r1 = round(1, 1, [{ team: "Alpha", place: 1, ks: 0, players: p("a") }, { team: "Beta", place: 2, ks: 0, players: p("b") }]);
    const r2 = round(2, 2, [{ team: "Team 3", place: 1, ks: 0, players: p("a") }, { team: "Team 4", place: 2, ks: 0, players: [{ nick: "x" }] }]);
    expect(computeGroup(group({ rounds: [r1, r2] })).standings.map((s) => [s.name, s.total])).toEqual([
      ["Alpha", 20],
      ["2R Team 4", 7],
      ["Beta", 7],
    ]);
  });

  it("기본 팀명이 같아도 선수가 다르면 다른 팀이다", () => {
    const p = (team: string) => [1, 2, 3].map((i) => ({ nick: `${team}${i}` }));
    const r1 = round(1, 1, [{ team: "Team 3", place: 1, ks: 0, players: p("a") }]);
    const r2 = round(2, 2, [{ team: "Team 3", place: 1, ks: 0, players: p("d") }, { team: "Alpha", place: 2, ks: 0, players: p("a") }]);
    const res = computeGroup(group({ rounds: [r1, r2] }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["Alpha", 17], ["2R Team 3", 10]]);
  });

  it("기본 팀명은 뒤 라운드의 팀 이름과도 이어진다", () => {
    const p = [1, 2, 3].map((i) => ({ nick: `x${i}` }));
    const r1 = round(1, 1, [{ team: "Team 1", place: 2, ks: 0, players: p }]);
    const r2 = round(2, 2, [{ team: "우리팀", place: 1, ks: 0, players: p }]);
    expect(computeGroup(group({ rounds: [r1, r2] })).standings.map((s) => [s.name, s.total])).toEqual([["우리팀", 17]]);
  });

  it("감점과 체크포인트 조정은 팀 이름을 바꾸거나 되돌려도 원래 팀을 따라간다", () => {
    const rounds = [places(1, ["Foo", "B"]), places(2, ["Foo", "B"]), places(3, ["Foo", "B"]), places(4, ["B", "Foo"])];
    const penalties = [{ id: 1, team: "Foo", roundNo: 1, kind: "rule" as const, count: 1, points: 5, reason: "지각" }];
    const renamed = computeGroup(group({ plannedRounds: 12, rounds, penalties, aliases: { Foo: "Bar" }, overrides: { "5:foo": false } }, "checkpoint"));
    expect(renamed.standings.map((s) => s.name).sort()).toEqual(["B", "Bar"]);
    expect(renamed.standings.find((s) => s.name === "Bar")!.penalty).toBe(5);
    expect(renamed.next?.checkpoint).toEqual(["B"]);
    const back = computeGroup(group({ plannedRounds: 12, rounds, penalties }, "checkpoint"));
    expect(back.standings.map((s) => s.name).sort()).toEqual(["B", "Foo"]);
  });

  it("팀 이름 바꾸기로 두 팀을 합친다", () => {
    const r1 = places(1, ["Alpha", "Beta"]);
    const r2 = places(2, ["알파", "Beta"]);
    const res = computeGroup(group({ rounds: [r1, r2], aliases: { 알파: "Alpha" } }));
    expect(res.standings.map((s) => [s.name, s.total])).toEqual([["Alpha", 20], ["Beta", 14]]);
  });
});

describe("밴", () => {
  it("3명은 다음 1라운드, 4명은 2라운드, 5명 이상은 3라운드 금지", () => {
    const pick = (char: string, n: number) => Array.from({ length: n }, (_, i) => ({ nick: `${char}${i}`, char }));
    const r1 = round(1, 1, [
      { team: "A", place: 1, ks: 0, players: [...pick("Tsubame", 5), ...pick("Rio", 4), ...pick("Leni", 3)] },
    ]);
    const g = (planned: number, rounds: number) =>
      computeGroup(group({ plannedRounds: planned, rounds: [r1, ...Array.from({ length: rounds - 1 }, (_, i) => places(i + 2, ["A"]))] })).next?.bans.sort();
    expect(g(8, 1)).toEqual(["Leni", "Rio", "Tsubame"]);
    expect(g(8, 2)).toEqual(["Rio", "Tsubame"]);
    expect(g(8, 3)).toEqual(["Tsubame"]);
    expect(g(8, 4)).toEqual([]);
  });

  it("3-PICK-BAN은 3명 이상 고른 실험체를 다음 1라운드만 금지한다", () => {
    const pick = (char: string, n: number) => Array.from({ length: n }, (_, i) => ({ nick: `${char}${i}`, char }));
    const r1 = round(1, 1, [
      { team: "A", place: 1, ks: 0, players: [...pick("Tsubame", 5), ...pick("Rio", 4), ...pick("Leni", 3), ...pick("Aya", 2)] },
    ]);
    const rules = { ...presetRules("masters"), bans: "basic" as const };
    const g = (rounds: number) =>
      computeGroup(group({ rules, plannedRounds: 8, rounds: [r1, ...Array.from({ length: rounds - 1 }, (_, i) => places(i + 2, ["A"]))] })).next?.bans.sort();
    expect(g(1)).toEqual(["Leni", "Rio", "Tsubame"]);
    expect(g(2)).toEqual([]);
  });

  it("밴을 끄면 금지 실험체가 없다", () => {
    const rules = { ...presetRules("masters"), bans: "none" as const };
    const r1 = round(1, 1, [{ team: "A", place: 1, ks: 0, players: [1, 2, 3].map((i) => ({ nick: `n${i}`, char: "Rio" })) }]);
    expect(computeGroup(group({ rules, rounds: [r1] })).next?.bans).toEqual([]);
  });
});

describe("날씨", () => {
  it("메인 날씨는 규정 순서로 채우고, 서브 날씨 후보는 4라운드마다 초기화한다", () => {
    const weather = [
      { roundNo: 1, main: null, sub: "벼락" },
      { roundNo: 2, main: null, sub: "무풍" },
      { roundNo: 3, main: "흐림", sub: "강풍" },
      { roundNo: 4, main: null, sub: "자색안개" },
    ];
    const at = (n: number) =>
      computeGroup(group({ plannedRounds: 8, weather, rounds: Array.from({ length: n }, (_, i) => places(i + 1, ["A"])) }));
    expect(at(2).next).toMatchObject({ roundNo: 3, main: "흐림", sub: "강풍", subRemaining: ["강풍", "자색안개"] });
    expect(at(3).next).toMatchObject({ roundNo: 4, main: "흐림", subRemaining: ["자색안개"] });
    expect(at(4).next).toMatchObject({ roundNo: 5, main: "모래바람", subRemaining: ["무풍", "강풍", "벼락", "자색안개"] });
    expect(at(4).rounds.map((r) => r.main)).toEqual(["모래바람", "비", "흐림", "흐림"]);
  });
});

describe("체크포인트", () => {
  const four = [0, 1, 2, 3].map((i) => places(i + 1, T, [0, 0, 0, 0, 0, 0, 0, 0]));

  it("5라운드 시작 때 상위 2팀이 체크포인트를 받는다", () => {
    const res = computeGroup(group({ plannedRounds: 12, rounds: four }, "checkpoint"));
    expect(res.next?.checkpoint).toEqual(["알파", "브라보"]);
    expect(res.standings.filter((s) => s.checkpoint).map((s) => s.name)).toEqual(["알파", "브라보"]);
  });

  it("체크포인트 팀이 1위를 하면 1위로 확정되고 끝난다", () => {
    const r5 = places(5, ["브라보", ...T.filter((t) => t !== "브라보")]);
    const res = computeGroup(group({ plannedRounds: 12, rounds: [...four, r5] }, "checkpoint"));
    expect(res.ended).toBe(true);
    expect(res.standings[0]).toMatchObject({ name: "브라보", fixed: 1 });
    expect(res.next).toBeNull();
  });

  it("체크포인트가 없는 팀이 1위를 하면 계속한다", () => {
    const r5 = places(5, ["호텔", ...T.filter((t) => t !== "호텔")]);
    const res = computeGroup(group({ plannedRounds: 12, rounds: [...four, r5] }, "checkpoint"));
    expect(res.ended).toBe(false);
    expect(res.standings.every((s) => s.fixed === null)).toBe(true);
  });

  it("더블 체크포인트는 2위가 확정될 때까지 이어진다", () => {
    const r5 = places(5, ["알파", ...T.filter((t) => t !== "알파")]);
    const one = computeGroup(group({ plannedRounds: 12, rounds: [...four, r5] }, "double"));
    expect(one.ended).toBe(false);
    expect(one.standings[0]).toMatchObject({ name: "알파", fixed: 1 });
    const r6 = places(6, ["브라보", ...T.filter((t) => t !== "브라보")]);
    const two = computeGroup(group({ plannedRounds: 12, rounds: [...four, r5, r6] }, "double"));
    expect(two.ended).toBe(true);
    expect(two.standings.slice(0, 2).map((s) => [s.name, s.fixed])).toEqual([["알파", 1], ["브라보", 2]]);
  });

  it("순위가 밀리면 체크포인트가 풀리고, 유지 설정이면 남는다", () => {
    const flip = places(5, [...T].reverse(), [0, 0, 0, 0, 20, 20, 0, 0]);
    const rounds = [...four, flip];
    const recompute = computeGroup(group({ plannedRounds: 12, rounds }, "checkpoint"));
    expect(recompute.next?.checkpoint).not.toContain("브라보");
    const rules = presetRules("masters");
    rules.checkpoint.keep = true;
    const keep = computeGroup(group({ rules, plannedRounds: 12, rounds }, "checkpoint"));
    expect(keep.next?.checkpoint).toContain("브라보");
  });

  it("라운드 사이 규정 위반 감점으로는 체크포인트가 풀리지 않는다", () => {
    const pen = [{ id: 1, team: "알파", roundNo: 5, kind: "rule" as const, count: 1, points: 50, reason: "지각" }];
    const r5 = places(5, ["호텔", ...T.filter((t) => t !== "호텔")]);
    const masters = computeGroup(group({ plannedRounds: 12, rounds: [...four, r5], penalties: pen }, "checkpoint"));
    expect(masters.next?.checkpoint).toContain("알파");
    const rules = presetRules("masters");
    rules.checkpoint.penaltyKeeps = false;
    const strict = computeGroup(group({ rules, plannedRounds: 12, rounds: [...four, r5], penalties: pen }, "checkpoint"));
    expect(strict.next?.checkpoint).not.toContain("알파");
  });

  it("점수 체크포인트는 기준 점수를 넘긴 다음 라운드부터 준다", () => {
    const rules = presetRules("masters");
    rules.checkpoint = { ...rules.checkpoint, type: "points", points: 30 };
    const res = computeGroup(group({ rules, plannedRounds: 12, rounds: four.slice(0, 3) }, "checkpoint"));
    expect(res.next?.checkpoint).toEqual(["알파"]);
  });

  it("운영자가 다음 라운드 체크포인트를 직접 바꿀 수 있다", () => {
    const res = computeGroup(group({ plannedRounds: 12, rounds: four, overrides: { "5:브라보": false, "5:호텔": true } }, "checkpoint"));
    expect(res.next?.checkpoint.sort()).toEqual(["알파", "호텔"].sort());
  });
});

describe("선수 기록", () => {
  it("라운드당 평균으로 순위를 매기고 같은 값은 같은 순위다", () => {
    const r1 = round(1, 1, [
      { team: "A", place: 1, ks: 0, players: [{ nick: "a", kill: 6, level: 20 }, { nick: "b", kill: 2, level: 20 }, { nick: "c", kill: 1, level: 18 }] },
    ]);
    const r2 = round(2, 2, [
      { team: "A", place: 1, ks: 0, players: [{ nick: "a", kill: 2, level: 18 }, { nick: "b", kill: 6, level: 18 }, { nick: "c", kill: 1, level: 18 }] },
    ]);
    const res = computeGroup(group({ rounds: [r1, r2] }));
    expect(res.players.map((p) => [p.nickname, p.kills, p.value, p.rank])).toEqual([["a", 8, 4, 1], ["b", 8, 4, 1], ["c", 2, 1, 3]]);
    expect(res.players[0]).toMatchObject({ rounds: 2, team: "A" });
  });
});

describe("순위 CSV", () => {
  it("수식으로 시작하는 팀 이름은 작은따옴표를 붙여 내보낸다", () => {
    const res = computeGroup(group({ rounds: [places(1, ["=HYPERLINK(1)", "보통"])] }));
    const text = standingsCsv(res);
    expect(text.startsWith("\ufeff순위,팀")).toBe(true);
    expect(text).toContain("'=HYPERLINK(1)");
    expect(text).toContain(",보통,");
  });
});

describe("규칙 정리", () => {
  it("순위 점수표는 항상 8칸이다", () => {
    expect(clampRules({ placementPoints: [12, 9] }, "custom").placementPoints).toEqual([12, 9, 0, 0, 0, 0, 0, 0]);
    expect(clampRules({ placementPoints: Array.from({ length: 20 }, () => 1) }, "custom").placementPoints).toHaveLength(8);
  });

  it("점수표 계산 여부는 규칙 선택으로만 정해진다", () => {
    expect(clampRules({ scoreSource: "table" }, "masters").scoreSource).toBe("csv");
    expect(clampRules({ scoreSource: "csv" }, "custom").scoreSource).toBe("table");
  });

  it("참거짓 규칙에는 참거짓 값만 남긴다", () => {
    const r = clampRules({ deathPenalty: "x".repeat(1_000_000), bans: 5, subWeather: {}, checkpoint: { type: "sequential", penaltyKeeps: "y" } } as never, "masters");
    expect([r.deathPenalty, r.subWeather, r.checkpoint.penaltyKeeps].every((v) => typeof v === "boolean")).toBe(true);
    expect(r.bans).toBe("strict");
    expect(JSON.stringify(r).length).toBeLessThan(1024);
  });

  it("밴 규칙은 예전에 저장한 참거짓 값도 읽는다", () => {
    const bans = (v: unknown) => clampRules({ bans: v } as never, "masters").bans;
    expect(bans(true)).toBe("strict");
    expect(bans(false)).toBe("none");
    expect(bans("basic")).toBe("basic");
    expect(bans("toString")).toBe("strict");
    expect(bans(undefined)).toBe("strict");
    expect(presetRules("masters").bans).toBe("strict");
  });
});
