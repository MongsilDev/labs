import "server-only";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import characters from "@/er/data/characters.json";
import { parseCsv } from "@/er/lib/csv";
import { EVENT_NAME, KEL_SCREENS, kelVisible, TEAM_BY_CSV, TEAM_BY_TAG, type KelEvent, type KelScreen } from "@/er/lib/kel";
import type { Round } from "@/er/lib/kel-calc";
import { currentUser, type User } from "./auth";
import { dakFiles, readDak, readScheduled, type KelDak } from "./kel-dakgg";

const viewer = cache(async (): Promise<{ user: User | null; owner: boolean }> => {
  const user = await currentUser();
  const id = process.env.KEL_OWNER_ID;
  return { user, owner: Boolean(id && user && user.id === id) };
});

// 스트리밍이 시작되기 전에 불러야 404 상태 코드가 나감
export async function kelGate(screen: KelScreen) {
  const v = await viewer();
  if (!kelVisible(screen, v.owner)) notFound();
  return v;
}

export async function kelMetadata(screen: KelScreen): Promise<Metadata> {
  const { owner } = await viewer();
  if (!kelVisible(screen, owner)) return {};
  const { title, public: open } = KEL_SCREENS[screen];
  const data = kelData();
  const description = `2026 KEL ${data ? `${kelSummary(data).games}게임의 ` : ""}팀, 선수, 실험체 기록입니다.`;
  return open ? { title, description } : { title, description, robots: { index: false, follow: false } };
}

export type KelRow = {
  event: KelEvent;
  stage: string;
  date: string;
  round: number;
  gameId: number;
  placement: number;
  team: string;
  player: string;
  character: string;
  kills: number;
  damage: number;
  taken: number;
  killScore: number;
  total: number;
  // 님블뉴런 CSV에만 있는 평점이라 dak.gg로 만든 행은 비움
  kpr?: number;
  deaths: number;
  dak?: KelDak;
};

export type TeamGame = {
  gameId: number;
  event: KelEvent;
  stage: string;
  date: string;
  round: number;
  team: string;
  placement: number;
  killScore: number;
  kills: number;
  total: number;
  damage: number;
  taken: number;
  characters: string[];
  // dak.gg 경기 상세가 없는 게임은 비움
  wickline?: boolean;
  cc?: number;
  heal?: number;
};

export type Kel = { rows: KelRow[]; games: TeamGame[] };

// 서킷 단계, 경기 순서대로
const STAGES = { group_a: "A조", group_b: "B조", upper_match: "승자조", lower_match: "패자조", lower_finals: "최종전", finals: "결승" } as const;
export const CIRCUIT_STAGES = Object.values(STAGES);

function stageOf(file: string): { event: KelEvent; stage: string } | null {
  if (/Opening_week_Group_Alpha/i.test(file)) return { event: "opening", stage: "알파 그룹" };
  if (/Opening_week_Group_Omega/i.test(file)) return { event: "opening", stage: "오메가 그룹" };
  if (/MIDSEASON_CUP_SEMIFINALS/i.test(file)) return { event: "msc", stage: "준결승" };
  if (/MIDSEASON_CUP_FINALS/i.test(file)) return { event: "msc", stage: "결승" };
  // 챔피언십 CSV 이름은 아직 공개되지 않아 SEMI가 들어간 이름만 준결승으로 봄
  if (/CHAMPIONSHIP.*SEMI/i.test(file)) return { event: "nc", stage: "준결승" };
  if (/CHAMPIONSHIP.*FINAL/i.test(file)) return { event: "nc", stage: "결승" };
  const m = /CIRCUIT_([1-4])_(Group_A|Group_B|Upper_Match|Lower_Match|Lower_Finals|Finals)_/i.exec(file);
  return m ? { event: `c${m[1]}` as KelEvent, stage: STAGES[m[2].toLowerCase() as keyof typeof STAGES] } : null;
}

const CHARACTER = new Map(Object.keys(characters).map((k) => [k.toLowerCase(), k]));
const characterKey = (name: string) => {
  const k = name.replace(/[&\s]/g, "");
  return CHARACTER.get(k.toLowerCase()) ?? k;
};

const COLUMNS = {
  date: "날짜",
  round: "라운드",
  gameId: "gameId",
  placement: "순위",
  team: "팀",
  player: "선수",
  character: "실험체",
  kills: "킬",
  damage: "가한피해",
  taken: "받은피해",
  killScore: "killScore",
  total: "TS",
  kpr: "KPR",
  deaths: "데스",
} as const;

function parseFile(file: string, text: string): KelRow[] {
  const where = stageOf(file);
  const [head, ...body] = parseCsv(text);
  if (!where || !head) return [];
  const at = Object.fromEntries(Object.entries(COLUMNS).map(([k, name]) => [k, head.indexOf(name)])) as Record<keyof typeof COLUMNS, number>;
  if (Object.values(at).some((i) => i < 0)) {
    console.error(`[kel] ${file}: 필요한 열이 없어 건너뜀`);
    return [];
  }
  const rows: KelRow[] = [];
  for (const r of body) {
    const team = TEAM_BY_CSV.get(r[at.team]?.trim());
    if (!team) continue;
    const num = (k: keyof typeof COLUMNS) => Number(r[at[k]]) || 0;
    const [round, gameId, placement] = [num("round"), num("gameId"), num("placement")];
    if (round < 1 || gameId < 1 || placement < 1 || placement > 8) continue;
    const raw = r[at.player]?.trim() ?? "";
    rows.push({
      ...where,
      date: r[at.date]?.trim() ?? "",
      round,
      gameId,
      placement,
      team: team.key,
      player: raw.includes("_") ? raw.slice(raw.indexOf("_") + 1) : raw,
      character: characterKey(r[at.character] ?? ""),
      kills: num("kills"),
      damage: num("damage"),
      taken: num("taken"),
      killScore: num("killScore"),
      total: num("total"),
      kpr: num("kpr"),
      deaths: num("deaths"),
    });
  }
  return rows;
}

function teamGames(rows: KelRow[]): TeamGame[] {
  const map = new Map<string, TeamGame>();
  for (const r of rows) {
    const key = `${r.gameId}:${r.team}`;
    let g = map.get(key);
    if (!g) {
      g = {
        gameId: r.gameId,
        event: r.event,
        stage: r.stage,
        date: r.date,
        round: r.round,
        team: r.team,
        placement: r.placement,
        killScore: r.killScore,
        kills: 0,
        total: r.total,
        damage: 0,
        taken: 0,
        characters: [],
      };
      map.set(key, g);
    }
    g.kills += r.kills;
    g.damage += r.damage;
    g.taken += r.taken;
    g.characters.push(r.character);
    if (r.dak) {
      g.wickline = g.wickline || r.dak.wickline;
      g.cc = (g.cc ?? 0) + r.dak.cc;
      g.heal = (g.heal ?? 0) + r.dak.heal;
    }
  }
  return [...map.values()];
}

// 님블뉴런 CSV에 없는 게임만 dak.gg 경기 상세로 채움. CSV가 공개되면 같은 gameId는 CSV 행이 대신함
function scheduledRows(known: Set<number>): KelRow[] {
  const rows: KelRow[] = [];
  for (const p of readScheduled(dir(), known)) {
    const at = p.nickname.indexOf("_");
    const team = at > 0 ? TEAM_BY_TAG.get(p.nickname.slice(0, at).toLowerCase()) : undefined;
    if (!team || !(p.event in EVENT_NAME) || p.round < 1 || p.rank < 1 || p.rank > 8) {
      console.error(`[kel] dak.gg ${p.gameId} ${p.nickname}: 팀이나 대회를 알 수 없어 건너뜀`);
      continue;
    }
    rows.push({
      event: p.event as KelEvent,
      stage: p.stage,
      date: p.date,
      round: p.round,
      gameId: p.gameId,
      placement: p.rank,
      team: team.key,
      player: p.nickname.slice(at + 1),
      character: characterKey(p.character),
      kills: p.kills,
      damage: p.damage,
      taken: p.taken,
      killScore: p.killScore,
      total: p.rankScore + p.killScore,
      deaths: p.deaths,
    });
  }
  return rows;
}

const store = globalThis as unknown as { __kel?: { sig: string; data: Kel | null } };
const dir = () => join(process.env.DATA_DIR || join(process.cwd(), "data"), "kel");

// characters.json에 아직 없는 실험체도 맞도록 소문자로 비교
const dakKey = (gameId: number, rank: number, character: string) => `${gameId}:${rank}:${character.toLowerCase()}`;

// 팀 접두어가 자료마다 달라 닉네임 대신 게임, 팀 순위, 실험체로 맞춤
function attachDak(rows: KelRow[]) {
  const dak = new Map(readDak(dir()).map((p) => [dakKey(p.gameId, p.rank, characterKey(p.character)), p.dak]));
  const used = new Set<string>();
  for (const r of rows) {
    const key = dakKey(r.gameId, r.placement, r.character);
    r.dak = dak.get(key);
    if (r.dak) used.add(key);
  }
  if (dak.size > used.size) console.error(`[kel] dak.gg 선수 ${dak.size - used.size}명을 경기 기록과 맞추지 못함`);
}

// 공개 레포라 CSV와 dak.gg 경기 상세는 서버 데이터 폴더에만 둠
export function kelData(): Kel | null {
  try {
    const files = readdirSync(dir())
      .filter((f) => f.endsWith(".csv"))
      .sort();
    // 읽지 못하는 파일은 이름만 넣고, 오류는 파일을 읽을 때 남김
    const sig = [...files, ...dakFiles(dir())]
      .map((f) => {
        try {
          const s = statSync(join(dir(), f));
          return `${f}:${s.size}:${s.mtimeMs}`;
        } catch {
          return f;
        }
      })
      .join("|");
    if (store.__kel?.sig === sig) return store.__kel.data;
    const csv = files.flatMap((f) => parseFile(f, readFileSync(join(dir(), f), "utf8")));
    const rows = [...csv, ...scheduledRows(new Set(csv.map((r) => r.gameId)))];
    attachDak(rows);
    const data = rows.length ? { rows, games: teamGames(rows) } : null;
    store.__kel = { sig, data };
    return data;
  } catch (e) {
    // 폴더가 없거나 읽는 중에 파일이 바뀐 경우
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("[kel] 경기 기록을 읽지 못함", e);
    return null;
  }
}

export type KelSummary = { games: number; first: string; last: string };

export function kelSummary(data: Kel): KelSummary {
  const dates = data.rows
    .map((r) => r.date)
    .filter(Boolean)
    .sort();
  return { games: new Set(data.rows.map((r) => r.gameId)).size, first: dates[0] ?? "", last: dates[dates.length - 1] ?? "" };
}

// bori.wiki 결과 표 점수와 경기 기록 점수의 차이, 종류는 대회 문서에 적힌 감점 사유 기준이고 사유가 없으면 penalty
const CORRECTIONS: { event: KelEvent; stage: string; round: number; team: string; points: number; kind: "penalty" | "rule" }[] = [
  { event: "c1", stage: "결승", round: 4, team: "gj-slasher", points: 3, kind: "rule" },
  // 미드 시즌 컵 준결승 두 줄은 아직 읽는 화면이 없지만 대조 결과라 남겨 둠
  { event: "msc", stage: "준결승", round: 1, team: "gj-slasher", points: 1, kind: "penalty" },
  { event: "msc", stage: "준결승", round: 6, team: "jeonnam-esports", points: 1, kind: "penalty" },
  { event: "msc", stage: "결승", round: 4, team: "daejeon-autoarms", points: 3, kind: "rule" },
  { event: "msc", stage: "결승", round: 4, team: "gyeongbuk-ascenders", points: 5, kind: "rule" },
  { event: "c4", stage: "결승", round: 3, team: "new-rise-gangwon", points: 1, kind: "penalty" },
  // 챔피언십 준결승은 공식 방송 경기 화면 순위표와 dak.gg 점수의 라운드별 차이, 사유는 미확인
  { event: "nc", stage: "준결승", round: 1, team: "gyeonggi-innate", points: 5, kind: "penalty" },
  { event: "nc", stage: "준결승", round: 4, team: "gyeonggi-innate", points: 1, kind: "penalty" },
  { event: "nc", stage: "준결승", round: 4, team: "seongnam-rox", points: 1, kind: "penalty" },
  { event: "nc", stage: "결승", round: 3, team: "daegu-guardians", points: 1, kind: "penalty" },
];

// 기록이 빠진 라운드는 빈칸으로 남음
export function stageRounds(data: Kel, event: KelEvent, stage: string): { teams: string[]; rounds: Round[] } {
  const games = data.games.filter((g) => g.event === event && g.stage === stage);
  const rounds: Round[] = [];
  for (const g of games) (rounds[g.round - 1] ??= {})[g.team] = { placement: g.placement, killScore: g.killScore, penalty: 0 };
  for (const c of CORRECTIONS) {
    const e = c.event === event && c.stage === stage ? rounds[c.round - 1]?.[c.team] : undefined;
    if (e) e[c.kind] = (e[c.kind] ?? 0) + c.points;
  }
  return { teams: [...new Set(games.map((g) => g.team))], rounds };
}
