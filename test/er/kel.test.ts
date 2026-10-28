import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { characterName } from "../../src/er/lib/format";
import { championshipTeams, KEL_TEAMS, seasonStandings } from "../../src/er/lib/kel";
import { finalState, placementPoints, standings, type Entry, type Round } from "../../src/er/lib/kel-calc";
import { kelData, stageRounds } from "../../src/er/server/kel";
import { lastHit } from "../../src/er/server/kel-dakgg";
import { kelOdds } from "../../src/er/server/kel-odds";
import { characterBuilds, comps, daysUntil, finals, killStats, lows, MIN_GAMES, playerStats, rankOf, kelHighlights, records, regions, seasonBuilds, teamOps, wicklines } from "../../src/er/server/kel-stats";
import { kelFixture } from "./helpers";

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "er-labs-kel-"));
afterAll(() => rmSync(process.env.DATA_DIR!, { recursive: true, force: true }));

const e = (placement: number, killScore = 0, penalty = 0): Entry => ({ placement, killScore, penalty });
const TEAMS = "abcdefgh".split("");
const order = (keys: string[], extra: Record<string, Partial<Entry>> = {}): Round => Object.fromEntries(keys.map((k, i) => [k, { ...e(i + 1), ...extra[k] }]));

describe("KEL 정규 시즌", () => {
  it("서킷 포인트 합계로 결승 직행 4팀과 준결승 8팀을 나눈다", () => {
    const { seeds, semi } = championshipTeams();
    expect(seeds.map((t) => t.name)).toEqual(["GC 부산 스텔라", "대전 오토암즈", "인천 웨이브", "경북 어센더스"]);
    expect(semi.map((t) => t.name)).toEqual(["경남 스파클", "성남 락스", "충남 CNJ", "뉴 라이즈 강원", "전남 이스포츠", "대구 가디언즈", "FN 세종", "경기 이네이트"]);
    expect(
      seasonStandings()
        .map((r) => r.total)
        .slice(0, 4),
    ).toEqual([1900, 1880, 1680, 1240]);
  });

  it("서킷마다 누적 순위를 매기고 마지막 순위는 시즌 순위와 같다", () => {
    const season = seasonStandings();
    expect(season.every((r) => r.ranks[3] === r.rank)).toBe(true);
    expect(season.every((r) => r.ranks[0] === r.team.circuits[0])).toBe(true);
    // 서킷 2까지 520점 동률은 서킷 2 순위로 가름, 미드 시즌 컵 2일차 직행과 같음
    const after2 = (name: string) => season.find((r) => r.team.name === name)!.ranks[1];
    expect([after2("성남 락스"), after2("대구 가디언즈")]).toEqual([4, 5]);
  });
});

describe("KEL 점수와 체크포인트", () => {
  it("총점, 킬 점수, 마지막 라운드 순위 순서로 줄을 세운다", () => {
    const rounds: Round[] = [{ a: e(1), b: e(2, 3), c: e(3, 1), d: e(4, 2) }];
    expect(standings(["a", "b", "c", "d"], rounds).map((r) => r.key)).toEqual(["b", "a", "d", "c"]);
    expect(
      standings(
        ["x", "y"],
        [
          { x: e(1), y: e(4) },
          { x: e(4), y: e(1) },
        ],
      ).map((r) => r.key),
    ).toEqual(["y", "x"]);
  });

  it("감점은 총점에서 뺀다", () => {
    const [top] = standings(["a", "b"], [{ a: e(1, 0, 4), b: e(2) }]);
    expect(top).toMatchObject({ key: "b", total: 7 });
  });

  it("결승은 5라운드부터 체크포인트를 주고, 체크포인트 팀이 1위를 하면 끝난다", () => {
    const four = [1, 2, 3, 4].map(() => order(TEAMS));
    const before = finalState(TEAMS, four);
    expect(before.next).toMatchObject({ roundNo: 5, checkpoint: ["a", "b"], weather: "a" });
    const r5 = order(["h", "a", "b", "c", "d", "e", "f", "g"]);
    const after5 = finalState(TEAMS, [...four, r5]);
    expect(after5.champion).toBeNull();
    expect(after5.next?.checkpoint).toHaveLength(3);
    const done = finalState(TEAMS, [...four, r5, order(TEAMS)]);
    expect(done.champion).toEqual({ key: "a", round: 6 });
    expect(done.rows[0].key).toBe("a");
    expect(done.next).toBeNull();
  });

  it("체크포인트 팀은 규정 감점으로 순위가 내려가도 체크포인트를 유지하고, 게임 안 감점이면 잃는다", () => {
    const four = [1, 2, 3, 4].map(() => order(TEAMS));
    const after = (cut: Partial<Entry>) => finalState(TEAMS, [...four, order(["d", "c", "b", "a", "e", "f", "g", "h"], { b: cut })]).next?.checkpoint.sort();
    expect(after({ rule: 8 })).toEqual(["a", "b", "c", "d"]);
    expect(after({ penalty: 8 })).toEqual(["a", "c", "d"]);
  });
});

describe("KEL 자료", () => {
  it("자료 폴더가 없으면 null을 돌려준다", () => {
    expect(kelData()).toBeNull();
    expect(kelHighlights(kelData())).toBeNull();
  });

  it("첫 화면 카드는 게임 수가 많은 실험체, 한 게임 최고 기록, 많이 나온 3인 조합을 세 개씩 고른다", () => {
    kelFixture(process.env.DATA_DIR!);
    const data = kelData()!;
    const h = kelHighlights(data)!;
    const games = [...Map.groupBy(data.rows, (r) => r.character)].map(([k, v]) => [k, new Set(v.map((r) => r.gameId)).size] as const).sort((a, b) => b[1] - a[1]);
    expect(h.characters.map((c) => c.games)).toEqual(games.slice(0, 3).map(([, n]) => n));
    expect(h.characters[0].rate).toBe(games[0][1] / new Set(data.rows.map((r) => r.gameId)).size);
    expect(h.bests.map((b) => [b.label, b.value])).toEqual([
      ["킬", Math.max(...data.rows.map((r) => r.kills))],
      ["가한 피해", Math.max(...data.rows.map((r) => r.damage))],
      ["받은 피해", Math.max(...data.rows.map((r) => r.taken))],
    ]);
    expect(h.comps).toEqual(comps(data, 1).slice(0, 3));
    expect(h.comps.length).toBeGreaterThan(0);
  });

  it("남은 날은 서울 날짜로 센다", () => {
    expect(daysUntil("2026-11-07", new Date("2026-10-23T14:59:00Z"))).toBe(15);
    expect(daysUntil("2026-11-07", new Date("2026-10-23T15:00:00Z"))).toBe(14);
    expect(daysUntil("2026-11-07", new Date("2026-11-06T15:30:00Z"))).toBe(0);
    expect(daysUntil("2026-11-08", new Date("2026-11-09T01:00:00Z"))).toBe(-1);
  });

  it("CSV를 읽어 팀 경기를 만들고 결과 표와 다른 점수는 감점으로 넣는다", () => {
    kelFixture(process.env.DATA_DIR!);
    const data = kelData()!;
    expect(data.games).toHaveLength(76 * 8);
    expect(new Set(data.rows.map((r) => r.character))).toEqual(new Set(["Nadine", "Alonso", "DebiMarlene", "LiDailin", "Niah", "YuMin", "Jackie", "Aya", "Eleven"]));
    const final = stageRounds(data, "c4", "결승");
    expect(final.teams).toHaveLength(8);
    expect(final.rounds[2]["new-rise-gangwon"].penalty).toBe(1);
  });

  it("dak.gg 경기 상세는 게임, 팀 순위, 실험체가 같은 경기 기록에 붙이고, 위클라인 처치는 팀 게임 단위로 센다", () => {
    kelFixture(process.env.DATA_DIR!);
    const data = kelData()!;
    expect(data.rows.filter((r) => !r.dak)).toEqual([]);
    const rec = records(data);
    expect([rec.cc!.dak.cc, rec.heal!.dak.heal, rec.camera!.dak.camera, rec.vision!.dak.vision]).toEqual([41, 1700, 6, 58]);
    const seconds = [...Map.groupBy(data.games, (g) => g.team)].map(([team, list]) => [team, list.filter((g) => g.placement === 2).length]);
    expect(Object.fromEntries(wicklines(data).map((w) => [w.team, w.count]))).toEqual(Object.fromEntries(seconds));
  });

  it("팀 최다 게임 점수는 순위 점수와 킬 점수를 더한 값이 가장 큰 팀 게임을 동점까지 날짜순으로 모두 넣는다", () => {
    kelFixture(process.env.DATA_DIR!);
    const data = kelData()!;
    const score = (g: (typeof data.games)[number]) => placementPoints(g.placement) + g.killScore;
    const max = Math.max(...data.games.map(score));
    const { teamScore } = records(data);
    expect(teamScore.value).toBe(max);
    expect(teamScore.games.map(score)).toEqual(teamScore.games.map(() => max));
    expect(teamScore.games).toHaveLength(data.games.filter((g) => score(g) === max).length);
    expect(teamScore.games.length).toBeGreaterThan(1);
    const dates = teamScore.games.map((g) => g.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("부진한 기록은 5위 안의 기록을 넣고, 같은 값은 같은 순위로 모두 넣는다", () => {
    kelFixture(process.env.DATA_DIR!);
    const { damage, deaths } = lows(kelData()!);
    expect(damage.map((x) => [x.rank, x.r.damage])).toEqual([
      [1, 300],
      [2, 610],
      [3, 820],
      [4, 905],
      [5, 1010],
    ]);
    expect(deaths.map((x) => [x.rank, x.r.deaths])).toEqual([[1, 10], ...Array.from({ length: 6 }, () => [2, 8])]);
  });

  it("dak.gg 경기 상세로 결승 날씨, 팀 운영 기록, 시작 지역과 사망 장소를 모은다", () => {
    kelFixture(process.env.DATA_DIR!);
    const data = kelData()!;
    const f = finals(data).at(-1)!;
    expect(f.weather).toHaveLength(f.rounds.length);
    expect(f.weather.every(Boolean)).toBe(true);
    const games = new Set(data.rows.map((r) => r.gameId)).size;
    const { rows, ranks } = teamOps(data, "season");
    expect(ranks).toEqual([0, games, 0, 0, 0, 0, 0, 0]);
    expect(rows.reduce((a, t) => a + t.escaped, 0)).toBe(new Set(data.rows.map((r) => `${r.event}:${r.stage}`)).size);
    const reg = regions(data);
    expect(reg.starts.reduce((a, s) => a + s.count, 0)).toBe(data.rows.length);
    expect(reg.deaths.reduce((a, d) => a + d.count, 0)).toBe(data.rows.length);
  });
});

describe("KEL 선수 기록", () => {
  beforeAll(() => kelFixture(process.env.DATA_DIR!));
  const key = (i: number) => KEL_TEAMS[i].key;

  it("킬 기록의 잡힌 실험체로 상대를 찾고, 같은 실험체 상대는 데스 기록으로 가리며, 그래도 못 가린 킬은 뺀다", () => {
    const k = killStats(kelData()!);
    expect([k.total, k.counted]).toEqual([5, 4]);
    expect(k.pairs.map((p) => [p.killer.player, p.victim.player, p.count]).sort()).toEqual([
      ["선수0-0", "선수4-0", 1],
      ["선수2-0", "선수5-1", 2],
      ["선수5-0", "선수2-2", 1],
    ]);
    expect(Object.fromEntries(k.teams)).toEqual({ [`${key(2)}|${key(5)}`]: 2, [`${key(5)}|${key(2)}`]: 1, [`${key(0)}|${key(4)}`]: 1 });
  });

  it("두 팀이 같은 게임에 나온 횟수는 양쪽이 같고, 팀 경기 기록에서 센 값과 맞는다", () => {
    const data = kelData()!;
    const { together } = killStats(data);
    const games = (t: string) => new Set(data.games.filter((g) => g.team === t).map((g) => g.gameId));
    for (const [a, b] of [
      [0, 4],
      [2, 5],
      [3, 15],
    ]) {
      const [x, y] = [games(key(a)), games(key(b))];
      const met = [...x].filter((g) => y.has(g)).length;
      expect(met).toBeGreaterThan(0);
      expect([together.get(`${key(a)}|${key(b)}`), together.get(`${key(b)}|${key(a)}`)]).toEqual([met, met]);
    }
    expect(together.has(`${key(0)}|${key(0)}`)).toBe(false);
  });

  it("군중제어 시간과 팀원 회복 비중은 팀 합계가 0인 게임을 0으로 넣어 평균한다", () => {
    const data = kelData()!;
    const p = playerStats(data).find((x) => x.name === "선수7-2")!;
    const teamGame = new Map(data.games.map((g) => [`${g.gameId}:${g.team}`, g]));
    const shares = data.rows
      .filter((r) => r.player === "선수7-2")
      .map((r) => {
        const g = teamGame.get(`${r.gameId}:${r.team}`)!;
        return g.heal ? r.dak!.heal / g.heal : 0;
      });
    expect(shares).toContain(0);
    expect(p.healShare).toBeCloseTo(shares.reduce((a, b) => a + b, 0) / shares.length, 12);
  });

  it("선수 기록에 데스, 카메라 파괴, 동료 부활, 생존 시간을 넣고, 데스는 적을수록 높은 순위다", () => {
    const all = playerStats(kelData()!);
    const p = all.find((x) => x.name === "선수4-0")!;
    expect(p.games).toBeGreaterThanOrEqual(MIN_GAMES);
    expect(p.time).toBeGreaterThan(600);
    expect(p.cameraOff).toBeGreaterThan(0);
    expect(all.some((x) => x.revive > 0)).toBe(true);
    const eligible = all.filter((x) => x.games >= MIN_GAMES);
    const fewest = eligible.reduce((a, x) => (x.deaths < a.deaths ? x : a));
    expect(rankOf(all, fewest, "deaths")).toBe(1);
    expect(rankOf(all, all.find((x) => x.games < MIN_GAMES)!, "deaths")).toBeNull();
  });

  it("경기 기록에서 맞춘 실험체 key는 한국어 이름으로 쓴다", () => {
    expect([characterName("YuMin"), characterName("DebiMarlene"), characterName("LiDailin")]).toEqual(["유민", "데비&마를렌", "리 다이린"]);
  });
});

describe("KEL 실험체 빌드", () => {
  beforeAll(() => kelFixture(process.env.DATA_DIR!));

  it("실험체 카드는 그 실험체를 고른 기록을 분모로 무기, 장비, 스킬 순서를 세고, 무기 칸 장비는 무기마다 따로 센다", () => {
    const data = kelData()!;
    const nadine = data.rows.filter((r) => r.character === "Nadine");
    const bow = nadine.filter((r) => r.dak!.weapon === "활").length;
    const b = characterBuilds(data).find((x) => x.key === "Nadine")!;
    expect(b.picks).toBe(nadine.length);
    expect(b.weapons.map((w) => [w.name, w.count])).toEqual([
      ["석궁", nadine.length - bow],
      ["활", bow],
    ]);
    expect(b.weapons[1].avgPlace).toBeCloseTo(nadine.filter((r) => r.dak!.weapon === "활").reduce((a, r) => a + r.placement, 0) / bow, 9);
    expect(b.gear.map((g) => [g.slot, g.name, g.share])).toEqual([
      ["석궁", "혈색반월", 1],
      ["활", "아르기로톡소스", 1],
      ["옷", "현자의 로브", 1],
      ["머리", "빛의 증표", 1],
      ["팔", "운명의 주사위", 1],
      ["다리", "알렉산드로스", 1],
    ]);
    const odd = nadine.filter((r) => r.round % 2).length;
    expect(b.order).toMatchObject(odd * 2 >= nadine.length ? { name: "E Q W E T R", count: odd } : { name: "Q W E Q T R", count: nadine.length - odd });
    expect(b.skills).toEqual({ T: "야성", Q: "황소의 눈", W: "다람쥐 덫", E: "원숭이 와이어", R: "늑대 맹습" });
    expect(b.players.length).toBeLessThanOrEqual(4);
    expect(b.players.reduce((a, p) => a + p.count, 0)).toBeLessThanOrEqual(nadine.length);
    expect(b.rate).toBe(new Set(nadine.map((r) => r.gameId)).size / new Set(data.rows.map((r) => r.gameId)).size);
  });

  it("마지막 일격 기술은 사망 기록 첫 칸에서 그 실험체가 처치한 수를 분모로 세고, 공식 이름을 못 찾은 기술은 원문 이름으로 넣는다", () => {
    const data = kelData()!;
    const deaths = data.rows.filter((r) => r.dak!.death);
    const b = characterBuilds(data).find((x) => x.key === "Nadine")!;
    expect(b.deaths).toBe(deaths.length);
    expect(b.lastHits.map((h) => h.name).sort()).toEqual(["기본 공격", "다람쥐 덫", "충전 - 섬광/철환", "황소의 눈"]);
    expect(b.unnamed).toBe(deaths.filter((r) => !r.dak!.death!.official).length);
    expect(b.unnamed).toBeGreaterThan(0);
    expect(b.lastHits.reduce((a, h) => a + h.count, 0)).toBe(b.deaths);
    expect(characterBuilds(data).find((x) => x.key === "Alonso")!.lastHits).toEqual([]);
  });

  it("무기가 하나뿐인 실험체는 최종 장비 무기 칸 이름표를 '무기'로 쓴다", () => {
    const alonso = characterBuilds(kelData()!).find((x) => x.key === "Alonso")!;
    expect(alonso.weapons).toHaveLength(1);
    expect(alonso.gear[0]).toMatchObject({ slot: "무기", weapon: alonso.weapons[0].name });
  });

  it("개인 최고 군중제어 시간과 팀원 회복은 기록이 모두 0이면 비운다", () => {
    const data = kelData()!;
    const name = "선수7-2";
    const zero = { ...data, rows: data.rows.map((r) => (r.player === name && r.dak ? { ...r, dak: { ...r.dak, heal: 0 } } : r)) };
    const p = playerStats(zero).find((x) => x.name === name)!;
    expect(p.bests.heal).toBeNull();
    expect(p.bests.cc).not.toBeNull();
    expect(playerStats(data).find((x) => x.name === name)!.bests.heal).not.toBeNull();
  });

  it("마지막 일격 기술 원문을 공식 이름으로 바꾸고, 공식 이름을 못 찾거나 스킬 이름 둘이 섞인 원문은 원문 이름으로 둔다", () => {
    const labels: Parameters<typeof lastHit>[2] = {
      names: new Map([
        ["Karla", "칼라"],
        ["Tia", "띠아"],
        ["DebiMarlene", "데비&마를렌"],
        ["Camilo", "카밀로"],
        ["Echion", "에키온"],
      ]),
      ids: new Map([
        ["Karla", 1],
        ["Tia", 2],
        ["DebiMarlene", 3],
        ["Camilo", 4],
        ["Echion", 5],
      ]),
      official: {
        own: new Map<number, [string, string][]>([
          [1, [["T", "작살 장전"], ["Q", "관통 작살"], ["W", "회수"]]],
          [2, [["T", "알록달록 컬러믹스"], ["Q", "브러쉬 스트로크"]]],
          [3, [["Q", "하드 슬래시"]]],
          [4, [["E", "알 꼼빠스"]]],
          [5, [["R", "독사의 진노"]]],
        ]),
        weapon: new Map([["도끼", "피의 나선"]]),
        common: new Map(["피의 나선", "벽력", "블래스터 탄환"].map((n) => [n.replace(/\s+/g, ""), n])),
      },
      weapons: new Map(),
      items: new Map(),
      tactical: new Map(),
      traits: new Map(),
      skills: new Map(),
    };
    // 이름표 이름은 labels()가 끝의 형태와 색 갈래를 뗀 것. 공식 이름을 못 찾은 원문은 처치 실험체 이름, 단계 번호, 끝 괄호와 N타를 뗌
    const cases: [string, string, string, boolean][] = [
      ["Karla", "basicAttack", "기본 공격", true],
      ["Karla", "칼라 Q - 관통 작살", "관통 작살", true],
      ["Karla", "칼라 W1", "회수", true],
      ["Karla", "칼라 강화공격", "기본 공격", true],
      ["Karla", "도끼 - 피의나선", "피의 나선", true],
      ["Karla", "파괴 - 벽력", "벽력", true],
      ["Karla", "블래스터 탄환v3", "블래스터 탄환", true],
      ["Karla", "관통 작살 회수", "관통 작살 회수", false],
      ["Karla", "칼라 구속 작살_2", "구속 작살", false],
      ["Karla", "구속 작살 2타", "구속 작살", false],
      ["Tia", "P - 알록달록 컬러믹스", "알록달록 컬러믹스", true],
      ["Tia", "Q - 브러쉬 스트로크 (노란)", "브러쉬 스트로크", true],
      ["Tia", "Q - 브러쉬 스트로크 (파란)", "브러쉬 스트로크", true],
      ["Tia", "Q", "브러쉬 스트로크", true],
      ["Echion", "독사의 진노(블랙맘바)", "독사의 진노", true],
      ["DebiMarlene", "데비 Q - 하드 슬래시", "하드 슬래시", true],
      ["Camilo", "알 콤빠스 (Al Compas)", "알 꼼빠스", true],
    ];
    expect(cases.map(([killer, text]) => lastHit(text, killer, labels))).toEqual(cases.map(([, , name, official]) => ({ name, official })));
  });

  it("전술 스킬과 핵심 특성 선택률은 선수 기록을, 대회별 칸은 그 대회의 선수 기록을 분모로 센다", () => {
    const data = kelData()!;
    const season = seasonBuilds(data);
    expect(season.records).toBe(data.rows.length);
    const bond = season.tactical.find((t) => t.name === "강한 결속")!;
    expect(bond.byEvent).toEqual({ opening: 0, c1: 0, c2: 0, msc: 0, c3: 0, c4: 1 / 3 });
    expect(bond.share).toBeCloseTo(data.rows.filter((r) => r.event === "c4").length / 3 / data.rows.length, 9);
    expect(season.tactical[0]).toMatchObject({ name: "블링크", share: 1 - bond.share });
    expect(season.traits.map((t) => [t.name, t.group, t.share])).toEqual([
      ["아드레날린", "파괴", 2 / 3],
      ["흡혈마", "파괴", 1 / 3],
    ]);
  });

  it("빌드 이름표가 없으면 그 이름만 비고 다른 값은 남는다", () => {
    rmSync(join(process.env.DATA_DIR!, "kel", "dakgg", "d_items.json"));
    const data = kelData()!;
    expect(data.rows.filter((r) => !r.dak)).toEqual([]);
    expect(data.rows.every((r) => r.dak!.gear.every((g) => g === "") && r.dak!.weapon)).toBe(true);
    expect(characterBuilds(data).find((x) => x.key === "Nadine")!.gear).toEqual([]);
  });
});

describe("KEL 3인 조합", () => {
  beforeAll(() => kelFixture(process.env.DATA_DIR!));

  it("조합마다 횟수, 평균 순위, 1위 횟수, 많이 고른 팀을 세고 많이 나온 순서로 줄을 세운다", () => {
    const data = kelData()!;
    const all = comps(data, 1);
    expect(all.reduce((a, c) => a + c.count, 0)).toBe(data.games.length);
    for (const c of all) expect(c.teams.reduce((a, [, n]) => a + n, 0)).toBe(c.count);
    expect(all.map((c) => c.count)).toEqual(all.map((c) => c.count).sort((a, b) => b - a));
    const first = all[0];
    const games = data.games.filter((g) => [...g.characters].sort().join() === [...first.characters].sort().join());
    expect(first).toMatchObject({ count: games.length, wins: games.filter((g) => g.placement === 1).length });
    expect(first.avgPlace).toBeCloseTo(games.reduce((a, g) => a + g.placement, 0) / games.length, 9);
    expect(first.teams[0][1]).toBe(Math.max(...first.teams.map(([, n]) => n)));
    expect(comps(data, first.count + 1)).toEqual([]);
  });
});

// 시점마다 10만 번 시뮬레이션해서 기본 5초 제한으로는 모자랄 수 있음
describe("KEL 진출 확률", { timeout: 30_000 }, () => {
  beforeAll(() => kelFixture(process.env.DATA_DIR!));

  it("단계마다 결승 직행, 준결승, 탈락 확률을 내고, 확정과 불가능 표시는 확률과 어긋나지 않으며, 처지가 같은 팀은 확률이 같다", async () => {
    const odds = (await kelOdds(kelData()!))!;
    expect(odds.views).toHaveLength(24);
    for (const v of odds.views) {
      [4, 8, 4].forEach((n, b) => expect(v.teams.reduce((s, o) => s + o.p[b], 0)).toBeCloseTo(n, 9));
      for (const o of v.teams)
        o.p.forEach((p, b) => {
          if (o.sure[b]) expect(p).toBe(1);
          if (o.never[b]) expect(p).toBe(0);
        });
    }
    const upper = odds.input.brackets[0]["승자조"];
    const early = odds.views.find((v) => v.circuit === 1 && v.done === 2)!;
    expect(new Set(upper.map((t) => early.teams[t].p.join()))).toHaveLength(1);
    const end = odds.views.find((v) => v.circuit === 4 && v.done === 6)!;
    expect(KEL_TEAMS.filter((_, t) => end.teams[t].sure[0]).map((t) => t.name).sort()).toEqual(championshipTeams().seeds.map((t) => t.name).sort());
  });

  it("서킷 4 결승만 남은 시점에는 순위 하나로 갈리는 조건을 문장으로 만든다", async () => {
    const odds = (await kelOdds(kelData()!))!;
    const lines = Object.fromEntries([...odds.cases].map(([t, l]) => [KEL_TEAMS[t].name, l]));
    expect(lines["경북 어센더스"]).toEqual(["서킷 4 결승에서 3위 안에 들면 결승 직행이 확정됩니다."]);
    expect(lines["양주 웨일즈"]).toEqual(["서킷 4 결승에서 1위를 차지하지 못하면 결승에 직행할 수 없습니다.", "4위 안에 들면 챔피언십 진출이 확정됩니다.", "5위 안에 들지 못하면 챔피언십에 진출하지 못합니다."]);
    expect(lines["경기 이네이트"]).toEqual(["FN 세종이 서킷 4 결승 6위 안에, 양주 웨일즈가 4위 안에 들면 챔피언십에 진출하지 못합니다."]);
  });

  it("서킷 단계별 경기 기록이 빠지면 계산하지 않는다", async () => {
    rmSync(join(process.env.DATA_DIR!, "kel", "2026_KEL_CIRCUIT_2_Lower_Finals_2026-07-11.csv"));
    expect(await kelOdds(kelData()!)).toBeNull();
  });
});
