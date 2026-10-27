import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseRoundCsv, type Player } from "../../src/er/lib/parse";
import type { RoundInput } from "../../src/er/lib/engine";
import { KEL_TEAMS } from "../../src/er/lib/kel";

export const HEADER =
  "rank, level, character, nickname, weapon, best weapon mastery, best weapon mastery level, total field kill, team kill, elimination, down can not eliminate, repeat down can not eliminate, down can eliminate, repeat down can eliminate, kill, assist, hunting, killer, gameId, teamName, tournament total score, tournament rank score, tournament kill score";

const RS = [10, 7, 5, 4, 3, 2, 1, 0];

type PlayerSpec = { nick: string; char?: string; kill?: number; hunting?: number; level?: number };

export type TeamSpec = {
  team: string;
  place: number;
  ks: number;
  kills?: number;
  players?: PlayerSpec[];
};

export function csv(gameId: number, teams: TeamSpec[]): string {
  const lines = [HEADER];
  for (const t of teams) {
    const players: PlayerSpec[] = t.players ?? [1, 2, 3].map((i) => ({ nick: `${t.team}-${i}`, char: `${t.team}${i}` }));
    for (const p of players) {
      const total = (RS[t.place - 1] ?? 0) + t.ks;
      lines.push(
        [
          t.place, p.level ?? 18, p.char ?? `${p.nick}-char`, p.nick, "", "Defense", 18, t.kills ?? 0, t.kills ?? 0, 0, 0, 0, 0, 0,
          p.kill ?? 0, 0, p.hunting ?? 40, "", gameId, t.team, total, RS[t.place - 1] ?? 0, t.ks,
        ].join(", "),
      );
    }
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function round(roundNo: number, gameId: number, teams: TeamSpec[]): RoundInput {
  const parsed = parseRoundCsv(csv(gameId, teams));
  if (!parsed.ok) throw new Error(parsed.error);
  return { roundNo, source: "csv", gameId, players: parsed.round.players };
}

export function places(roundNo: number, order: string[], ks: number[] = []): RoundInput {
  return round(
    roundNo,
    1000 + roundNo,
    order.map((team, i) => ({ team, place: i + 1, ks: ks[i] ?? 0 })),
  );
}

export type { Player };

const KEL_HEADER = "매치,날짜,라운드,gameId,순위,팀,선수,실험체,킬,어시,데스,채집,가한피해,받은피해,rankScore,killScore,TS,크레딧,KPR";
const KEL_CHARS = ["Nadine", "Alonso", "Debi & Marlene", "Li Dailin", "NiaH", "Yumin", "Jackie", "Aya", "Eleven"];
// dak.gg 실험체 이름표의 key, 경기 기록의 영문 이름과 표기가 다름
const DAK_KEYS = ["Nadine", "Alonso", "DebiMarlene", "LiDailin", "Niah", "YuMin", "Jackie", "Aya", "Eleven"];

// dak.gg 지역과 날씨 이름표의 일부
const AREAS = [
  { id: 10, name: "항구" },
  { id: 20, name: "창고" },
  { id: 30, name: "연못" },
  { id: 40, name: "바지선" },
];
const WEATHERS = [
  { key: 10001, name: "흐림" },
  { key: 10002, name: "쾌청" },
  { key: 10003, name: "비" },
  { key: 10004, name: "모래바람" },
];

// 빌드 이름표. 나딘(1번)은 Q칸 스킬이 둘이라 번호가 작은 이름이 기준이고, R은 끝에 형태 갈래가 붙은 이름
const DAK_LABELS = {
  "d_masteries.json": { masteries: [{ id: 1, name: "석궁" }, { id: 2, name: "활" }] },
  "d_items.json": { items: [101, 102, 201, 301, 401, 501].map((id, i) => ({ id, name: ["혈색반월", "아르기로톡소스", "현자의 로브", "빛의 증표", "운명의 주사위", "알렉산드로스"][i] })) },
  "d_tactical-skills.json": { tacticalSkills: [{ id: 30, name: "블링크" }, { id: 40, name: "강한 결속" }] },
  "d_trait-skills.json": {
    traitSkillGroups: [{ key: "Havoc", name: "파괴" }],
    traitSkills: [{ id: 7000401, name: "흡혈마", group: "Havoc" }, { id: 7000601, name: "아드레날린", group: "Havoc" }],
  },
  "d_skills.json": {
    skills: [
      { id: 1033250, characterId: 1, slot: "Q", name: "황소의 눈 강화" },
      ...["T", "Q", "W", "E", "R"].map((slot, i) => ({ id: 1033100 + i * 100, characterId: 1, slot, name: ["야성", "황소의 눈", "다람쥐 덫", "원숭이 와이어", "늑대 맹습[야성]"][i] })),
      { id: 3008000, characterIds: [1], slot: "D", weaponTypeId: 1, name: "강노" },
    ],
  },
};
// 사망 기록 첫 칸의 마지막 일격 기술 원문, 마지막 값은 이름표에 공식 이름이 없음
const CAUSES = ["basicAttack", "나딘 Q - 황소의 눈", "다람쥐 덫_2", "나딘 Q2", "충전 - 섬광/철환"];

// 첫 게임의 팀 순서-선수 순서별 가한 피해
const LOW_DAMAGE = new Map([
  ["7-0", 300],
  ["7-1", 610],
  ["7-2", 820],
  ["6-0", 905],
  ["6-1", 1010],
]);

// 첫 게임의 킬과 데스, 키는 팀 순서-선수 순서이고 값의 키는 상대 실험체 번호
// 실험체가 하나뿐인 상대(2-0이 5-1을, 5-0이 2-2를), 같은 실험체 셋 가운데 데스 기록으로 가리는 상대(0-0이 4-0을), 데스 기록으로도 못 가리는 상대(0-1이 1-1과 4-1 가운데 하나를)
const KILLS = new Map<string, Record<string, number>>([
  ["2-0", { 9: 2 }],
  ["5-0", { 1: 1 }],
  ["0-0", { 5: 1 }],
  ["0-1", { 6: 1 }],
]);
const DEATHS = new Map<string, Record<string, number>>([
  ["5-1", { 8: 2 }],
  ["2-2", { 8: 1 }],
  ["4-0", { 2: 1 }],
  ["1-1", { 3: 1 }],
  ["4-1", { 3: 1 }],
]);

// 단계별 경기 날짜는 서킷 첫날부터 센 날수
const DAYS = [0, 0, 1, 7, 7, 8];
const shift = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

// 서킷 최종 순위에 맞춘 단계별 8팀. 1~8위 가운데 홀수 순위는 승자조에서 바로, 짝수 순위는 최종전을 거쳐 결승에 감
function bracket(c: number): [string, string[]][] {
  const byRank = [...KEL_TEAMS].sort((a, b) => a.circuits[c - 1] - b.circuits[c - 1]).map((t) => t.csv);
  const direct = byRank.filter((_, i) => i < 8 && i % 2 === 0);
  const via = byRank.filter((_, i) => i < 8 && i % 2 === 1);
  const nine = byRank.slice(8, 12);
  const upper = [...direct, via[0], via[1], nine[0], nine[1]];
  const lower = [via[2], via[3], nine[2], nine[3], ...byRank.slice(12)];
  return [
    ["Group_A", [...upper.slice(0, 4), ...lower.slice(0, 4)]],
    ["Group_B", [...upper.slice(4), ...lower.slice(4)]],
    ["Upper_Match", upper],
    ["Lower_Match", lower],
    ["Lower_Finals", [...via, ...nine]],
    ["Finals", byRank.slice(0, 8)],
  ];
}

// 실제 경기 기록 대신 지어낸 값으로 KEL CSV를 만듦
export function kelFixture(dataDir: string) {
  const dir = join(dataDir, "kel");
  mkdirSync(dir, { recursive: true });
  const all = KEL_TEAMS.map((t) => t.csv);
  // 서킷 결승에 자주 오른 팀 선수는 30게임을 넘겨 선수끼리 견주는 화면에도 나옴
  const files: [string, string[], number][] = [
    ["2026_KEL_Opening_week_Group_Alpha_2026-05-22.csv", all.slice(0, 8), 4],
    ["2026_KEL_MIDSEASON_CUP_SEMIFINALS_2026-08-01.csv", all.slice(8, 16), 6],
    ...(["2026-06-06", "2026-07-04", "2026-09-12", "2026-10-10"] as const).flatMap((start, i) =>
      bracket(i + 1).map(([stage, teams], k): [string, string[], number] => [`2026_KEL_CIRCUIT_${i + 1}_${stage}_${shift(start, DAYS[k])}.csv`, teams, stage === "Finals" ? (i === 2 ? 8 : 6) : 2]),
    ),
  ];
  const dak = join(dir, "dakgg");
  mkdirSync(join(dak, "games"), { recursive: true });
  writeFileSync(join(dak, "d_characters.json"), JSON.stringify({ characters: DAK_KEYS.map((key, i) => ({ id: i + 1, key, name: i ? key : "나딘" })) }));
  writeFileSync(join(dak, "d_areas.json"), JSON.stringify({ areas: AREAS }));
  writeFileSync(join(dak, "d_weathers.json"), JSON.stringify({ weathers: WEATHERS }));
  for (const [file, json] of Object.entries(DAK_LABELS)) writeFileSync(join(dak, file), JSON.stringify(json));
  files.forEach(([name, teams, rounds], f) => {
    const date = name.slice(-14, -4);
    const lines = [KEL_HEADER];
    for (let r = 1; r <= rounds; r++) {
      const gameId = 10_000 + f * 100 + r;
      const players: object[] = [];
      const skillInfos: object[] = [];
      const c4 = name.includes("CIRCUIT_4");
      teams.forEach((team, i) => {
        const g = all.indexOf(team);
        const place = ((i + r * 3) % teams.length) + 1;
        const ks = ((r + i) % 5) * 1.5;
        for (let p = 0; p < 3; p++) {
          const c = (i * 3 + p + r) % KEL_CHARS.length;
          // 첫 게임에만 최다 데스와 최저 가한 피해를 따로 두어 부진한 기록 표가 다섯 줄 남짓 나옴
          const first = f === 0 && r === 1;
          const deaths = first && p === 0 && i < 7 ? (i ? 8 : 10) : p % 2;
          const low = first ? LOW_DAMAGE.get(`${i}-${p}`) : undefined;
          lines.push(
            [
              name.slice(0, -15).replace(/_/g, " "), date, r, gameId, place, team, `T${g}_선수${g}-${p}`, KEL_CHARS[c],
              (r + i + p) % 4, (i + p) % 6, deaths, 30 + i, low ?? 9000 + i * 700 + p * 300 + r * 50, 7000 + p * 900 + i * 100, RS[place - 1], ks, RS[place - 1] + ks, 1500 + i, (1 + ((i + p) % 3) / 2).toFixed(3),
            ].join(","),
          );
          // 위클라인은 2위 팀 세 명이 모두 처치 크레딧을 받고, 파일마다 첫 라운드의 3위 팀이 탈출함. 첫 게임의 마지막 팀은 팀원 회복이 0
          players.push({
            gameId,
            gameRank: place,
            characterNum: c + 1,
            ccTimeToPlayer: 10 + i * 3 + p + r,
            teamRecover: first && i === 7 ? 0 : 500 * p + 100 * i,
            protectAbsorb: 50 * r,
            addTelephotoCamera: (i + p + r) % 7,
            removeTelephotoCamera: (i + r) % 3,
            viewContribution: 20 + i * 4 + p + r,
            creditRevivedOthersCount: p === 2 && r % 2 ? 1 : 0,
            killWicklineGainVFCredit: place === 2 ? 10 : 0,
            playTime: 600 + (8 - place) * 90 + p * 10,
            placeOfStart: String(AREAS[(i + p) % AREAS.length].id),
            placeOfDeath: String(AREAS[(i + r) % AREAS.length].id),
            escapeState: place === 3 && r === 1 ? 3 : 0,
            mainWeather: WEATHERS[r % WEATHERS.length].key,
            ...(first && KILLS.has(`${i}-${p}`) && { killDetails: JSON.stringify(KILLS.get(`${i}-${p}`)) }),
            ...(first && DEATHS.has(`${i}-${p}`) && { deathDetails: JSON.stringify(DEATHS.get(`${i}-${p}`)) }),
            // 나딘은 짝수 자리가 석궁, 홀수 자리가 활. 서킷 4에서만 첫 자리가 강한 결속, 핵심 특성은 첫 자리만 흡혈마
            userNum: i * 3 + p + 1,
            bestWeapon: c === 0 && p % 2 ? 2 : 1,
            equipment: { 0: c === 0 && p % 2 ? 102 : 101, 1: 201, 2: 301, 3: 401, 4: 501 },
            tacticalSkillGroup: c4 && p === 0 ? 40 : 30,
            traitFirstCore: p === 0 ? 7000401 : 7000601,
            // 둘째 자리 선수는 모두 나딘에게 처치됨
            ...(p === 1 ? { killer: "player", killerCharacter: "Nadine", causeOfDeath: CAUSES[(r + i) % CAUSES.length] } : { killer: "" }),
          });
          skillInfos.push({ userNum: i * 3 + p + 1, orders: r % 2 ? ["E", "Q", "W", "E", "T", "R", "Q"] : ["Q", "W", "E", "Q", "T", "R"] });
        }
      });
      writeFileSync(join(dak, "games", `${gameId}.json`), JSON.stringify({ skillInfos, games: players }));
    }
    writeFileSync(join(dir, name), "\ufeff" + lines.join("\n") + "\n");
  });
}
