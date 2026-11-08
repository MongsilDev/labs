import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// dak.gg 경기 상세에서 화면에 쓰는 값만 남김
export type KelDak = {
  cc: number;
  heal: number;
  camera: number;
  vision: number;
  wickline: boolean;
  time: number;
  // 지역과 날씨는 한국어 이름, 이름표에 없으면 빈 문자열
  start: string;
  deathPlaces: string[];
  escaped: boolean;
  weather: string;
  cameraOff: number;
  revive: number;
  // 킬과 데스는 상대 실험체 번호별 횟수
  num: number;
  killed: Record<string, number>;
  killedBy: Record<string, number>;
  // 빌드는 이름표로 바꾼 이름, 이름표가 없으면 빈 문자열
  weapon: string;
  tactical: string;
  trait: string;
  traitGroup: string;
  // 무기, 옷, 머리, 팔, 다리 순서
  gear: string[];
  // 1~6레벨에 찍은 스킬 칸, 예: "E Q W E T R"
  order: string;
  // 스킬 칸 이름, 같은 실험체 기록이 한 객체를 같이 씀
  skills: Partial<Record<SkillSlot, string>>;
  // 사망 기록 첫 칸의 처치 실험체(dak.gg 영문 key)와 마지막 일격 기술. 공식 이름을 못 찾으면 원문 이름이고 official이 false
  death: { character: string; cause: string; official: boolean } | null;
};

export type SkillSlot = "Q" | "W" | "E" | "R" | "T";
export const SKILL_SLOTS: SkillSlot[] = ["Q", "W", "E", "R", "T"];

type Player = {
  gameId: number;
  gameRank: number;
  characterNum: number;
  ccTimeToPlayer?: number;
  teamRecover?: number;
  addTelephotoCamera?: number;
  removeTelephotoCamera?: number;
  viewContribution?: number;
  creditRevivedOthersCount?: number;
  playTime?: number;
  killWicklineGainVFCredit?: number;
  placeOfStart?: string;
  placeOfDeath?: string;
  placeOfDeath2?: string;
  placeOfDeath3?: string;
  escapeState?: number;
  mainWeather?: number;
  killDetails?: string;
  deathDetails?: string;
  userNum?: number;
  bestWeapon?: number;
  equipment?: Record<string, number>;
  tacticalSkillGroup?: number;
  traitFirstCore?: number;
  killer?: string;
  killerCharacter?: string;
  causeOfDeath?: string;
};

type Labels = {
  names: Map<string, string>;
  weapons: Map<number, string>;
  items: Map<number, string>;
  tactical: Map<number, string>;
  traits: Map<number, { name: string; group: string }>;
  skills: Map<number, Partial<Record<SkillSlot, string>>>;
  ids: Map<string, number>;
  official: Official;
};

// 마지막 일격 기술을 맞출 공식 이름. own은 실험체 번호별 [스킬 칸, 이름], weapon은 무기 종류 이름별 무기 스킬
type Official = { own: Map<number, [string, string][]>; weapon: Map<string, string>; common: Map<string, string> };

const GAMES = "dakgg/games";
const CHARACTERS = "dakgg/d_characters.json";
const AREAS = "dakgg/d_areas.json";
const WEATHERS = "dakgg/d_weathers.json";
// CSV가 아직 없는 경기 명단, 형식은 readScheduled 참고
const SCHEDULE = "dakgg/schedule.json";
const LABELS = ["d_masteries", "d_items", "d_tactical-skills", "d_trait-skills", "d_skills"].map((f) => `dakgg/${f}.json`);

const games = (dir: string) =>
  readdirSync(join(dir, GAMES))
    .filter((f) => f.endsWith(".json"))
    .sort();

// kelData 서명에 넣는 경로, 폴더를 읽지 못하면 이름표만 넣고 오류는 readDak에서 남김
export function dakFiles(dir: string): string[] {
  try {
    return [CHARACTERS, AREAS, WEATHERS, SCHEDULE, ...LABELS, ...games(dir).map((f) => `${GAMES}/${f}`)];
  } catch {
    return [CHARACTERS, AREAS, WEATHERS, SCHEDULE, ...LABELS];
  }
}

// 지역과 날씨 이름표는 읽지 못해도 그 값만 비우고 나머지는 씀
function names(dir: string, file: string, list: string, id: string): Map<string, string> {
  try {
    const rows: Record<string, unknown>[] = JSON.parse(readFileSync(join(dir, file), "utf8"))[list];
    return new Map(rows.map((x) => [String(x[id]), String(x.name)]));
  } catch (e) {
    console.error(`[kel] dak.gg ${file}를 읽지 못함`, e);
    return new Map();
  }
}

// 빌드 이름표는 따로 읽어, 하나가 없어도 그 이름만 비고 나머지 값은 남음
function readLabel<T>(dir: string, file: string, read: (json: Record<string, unknown>) => [number, T][]): Map<number, T> {
  try {
    return new Map(read(JSON.parse(readFileSync(join(dir, file), "utf8"))));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error(`[kel] dak.gg ${file}를 읽지 못함`, e);
    return new Map();
  }
}

const counts = (json?: string): Record<string, number> => {
  try {
    const v: unknown = json ? JSON.parse(json) : null;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter((e): e is [string, number] => Number.isFinite(e[1])));
  } catch {
    return {};
  }
};

type Named = { id: number; name: string };
type Skill = Named & { characterId?: number; characterIds?: number[]; slot?: string; weaponTypeId?: number };
type Item = Named & { tooltip?: string };

// 한 칸에 스킬이 여럿인 실험체는 번호가 가장 작은 스킬 이름을 씀
function skillNames(list: Skill[]) {
  const map = new Map<number, Partial<Record<SkillSlot, string>>>();
  for (const s of [...list].sort((a, b) => a.id - b.id)) {
    if (s.characterId === undefined || !SKILL_SLOTS.includes(s.slot as SkillSlot)) continue;
    const names = map.get(s.characterId) ?? {};
    names[s.slot as SkillSlot] ??= s.name;
    map.set(s.characterId, names);
  }
  return [...map];
}

// 에키온 '독사의 진노[바이퍼]', 띠아 '브러쉬 스트로크 - 노란색'처럼 이름 끝에 붙은 형태와 색 갈래는 뗌. 갈래가 바뀌어도 같은 스킬
const plain = (name: string) => name.replace(/\[[^\]]*\]$/, "").replace(/ - [가-힣]+색$/, "");
// 아이템 설명에 노란 굵은 글씨로 적힌 고유 능력 이름
const ABILITY = /<b><color=yellow>([^<]+)<\/color><\/b>/g;
// 이름 비교에서 빼는 공백과 끝 문장부호
const bare = (s: string) => s.replace(/\s+/g, "").replace(/[.!]+$/, "");

function officialNames(skills: Skill[], weapons: Map<number, string>, common: string[]): Official {
  const own = new Map<number, [string, string][]>();
  for (const s of [...skills].sort((a, b) => a.id - b.id)) {
    for (const c of s.characterId === undefined ? (s.characterIds ?? []) : [s.characterId]) own.set(c, [...(own.get(c) ?? []), [s.slot ?? "", s.name]]);
  }
  const weaponSkills = skills.filter((s) => s.slot === "D");
  return {
    own,
    weapon: new Map(weaponSkills.flatMap((s): [string, string][] => (weapons.has(s.weaponTypeId ?? -1) ? [[weapons.get(s.weaponTypeId!)!, s.name]] : []))),
    common: new Map([...common, ...weaponSkills.map((s) => s.name)].filter(Boolean).map((n) => [bare(n), n])),
  };
}

function labels(dir: string): Omit<Labels, "names" | "ids"> {
  const [weapons, items, tactical, traits, skills] = LABELS;
  const named = (k: string) => (j: Record<string, unknown>) => (j[k] as Named[]).map((x): [number, string] => [x.id, x.name]);
  const whole =
    <T extends Named>(k: string) =>
    (j: Record<string, unknown>) =>
      (j[k] as T[]).map((x): [number, T] => [x.id, x]);
  const weaponNames = readLabel(dir, weapons, named("masteries"));
  const itemList = [...readLabel(dir, items, whole<Item>("items")).values()];
  const tacticalNames = readLabel(dir, tactical, named("tacticalSkills"));
  const traitNames = readLabel(dir, traits, (j) => {
    const groups = new Map((j.traitSkillGroups as { key: string; name: string }[]).map((g) => [g.key, g.name]));
    return (j.traitSkills as (Named & { group: string })[]).map((t) => [t.id, { name: t.name, group: groups.get(t.group) ?? "" }]);
  });
  const skillList = [...readLabel(dir, skills, whole<Skill>("skills")).values()].map((s) => ({ ...s, name: plain(s.name) }));
  const abilities = itemList.flatMap((x) => [...(x.tooltip ?? "").matchAll(ABILITY)].map((m) => m[1]));
  return {
    weapons: weaponNames,
    items: new Map(itemList.map((x) => [x.id, x.name])),
    tactical: tacticalNames,
    traits: traitNames,
    skills: new Map(skillNames(skillList)),
    official: officialNames(skillList, weaponNames, [...[...traitNames.values()].map((t) => t.name), ...tacticalNames.values(), ...abilities]),
  };
}

const GEAR_SLOTS = 5;
const NO_SKILLS = {};

const BASIC_ATTACK = "기본 공격";
// 끝의 괄호, 'N타', 'v3' 같은 판 번호는 공식 이름에 없음
const tail = (s: string) =>
  s
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s*\d+타$/, "")
    .replace(/v\d+$/, "")
    .trim();
// Q, Q1, Q_1, EQ, 강화 Q처럼 스킬 칸으로 시작하는 원문, P는 패시브
const SLOT = /^(?:강화\s*)?([QWERPTD])([QWER])?(?:_?\d)?(?=$|[\s\-[])/;
const BASIC = /^(기본\s*공격|강화\s*공격|평타\s*강화|NormalAttack)/;

// 이름표와 철자만 다르고 같은 기술이 확실한 원문
const ALIASES = new Map([["알 콤빠스", "알 꼼빠스"]]);

// dak.gg 원문은 '아르다 Q - 샤마쉬의 두루마리', '도끼 - 피의나선', 'Q1' 같은 내부 이름이라 이름표의 공식 이름으로 바꾸고, 못 바꾸면 처치 실험체 이름, 단계 번호, 끝 괄호를 뗀 원문을 씀
export function lastHit(text: string, killer: string, l: Labels): { name: string; official: boolean } {
  if (text === "basicAttack") return { name: BASIC_ATTACK, official: true };
  const name = l.names.get(killer) ?? "";
  const prefix = [name, ...name.split("&")].find((n) => n && text.startsWith(`${n} `));
  const t = (prefix ? text.slice(prefix.length + 1) : text).replace(/_\d+$/, "").trim() || text.trim();
  const found = officialName(ALIASES.get(tail(t)) ?? t, killer, l);
  return found ? { name: found, official: true } : { name: tail(t) || t, official: false };
}

function officialName(t: string, killer: string, l: Labels): string {
  const own = l.official.own.get(l.ids.get(killer) ?? -1) ?? [];
  const mine = new Map(own.map(([, n]) => [bare(n), n]));
  const find = (x: string) => mine.get(bare(tail(x))) ?? l.official.common.get(bare(tail(x)));
  const dash = /^(.*?)\s*-\s*(.*)$/.exec(t);
  const [head, rest] = dash ? [dash[1], dash[2]] : [t, ""];
  const direct = find(t) ?? (rest ? find(rest) : undefined);
  if (direct) return direct;
  const slot = SLOT.exec(t);
  if (slot) {
    const after = t.slice(slot[0].length).replace(/^[\s\-[]+|[\s\]]+$/g, "");
    const named = after ? find(after) : undefined;
    if (named) return named;
    const key = (slot[2] ?? slot[1]).replace("P", "T");
    return own.find(([s]) => s === key)?.[1] ?? "";
  }
  if (head.startsWith("패시브")) return own.find(([s]) => s === "T")?.[1] ?? "";
  const named = l.official.weapon.get(head) ?? find(head);
  if (named) return named;
  if (BASIC.test(t)) return BASIC_ATTACK;
  // '하나레 화궁'처럼 스킬 이름으로 시작하는 원문. '관통 작살 회수'처럼 남은 말도 스킬 이름이면 어느 쪽인지 몰라 맞추지 않음
  const k = bare(t);
  const start = [...mine.keys()].sort((a, b) => b.length - a.length).find((n) => k.startsWith(n));
  return start && !mine.has(k.slice(start.length)) ? mine.get(start)! : "";
}

const deathOf = (character: string, hit: { name: string; official: boolean }) => ({ character, cause: hit.name, official: hit.official });

// protectAbsorb는 자기 몸의 보호막이 막은 피해라 팀원 회복에 넣지 않음
const pick = (p: Player, l: Labels, order: string[], areas: Map<string, string>, weathers: Map<string, string>): KelDak => {
  const name = (map: Map<number, string>, id?: number) => (id === undefined ? "" : (map.get(id) ?? ""));
  const trait = p.traitFirstCore === undefined ? undefined : l.traits.get(p.traitFirstCore);
  return {
    cc: p.ccTimeToPlayer ?? 0,
    heal: p.teamRecover ?? 0,
    camera: p.addTelephotoCamera ?? 0,
    cameraOff: p.removeTelephotoCamera ?? 0,
    vision: p.viewContribution ?? 0,
    revive: p.creditRevivedOthersCount ?? 0,
    time: p.playTime ?? 0,
    wickline: (p.killWicklineGainVFCredit ?? 0) > 0,
    start: areas.get(String(p.placeOfStart)) ?? "",
    // 사망 장소는 선수마다 세 칸까지만 남음
    deathPlaces: [p.placeOfDeath, p.placeOfDeath2, p.placeOfDeath3].flatMap((c) => areas.get(String(c)) ?? []),
    escaped: p.escapeState === 3,
    weather: weathers.get(String(p.mainWeather)) ?? "",
    num: p.characterNum,
    killed: counts(p.killDetails),
    killedBy: counts(p.deathDetails),
    weapon: name(l.weapons, p.bestWeapon),
    tactical: name(l.tactical, p.tacticalSkillGroup),
    trait: trait?.name ?? "",
    traitGroup: trait?.group ?? "",
    gear: Array.from({ length: GEAR_SLOTS }, (_, i) => name(l.items, p.equipment?.[i])),
    order: order.slice(0, 6).join(" "),
    skills: l.skills.get(p.characterNum) ?? NO_SKILLS,
    death: p.killer === "player" && p.killerCharacter && p.causeOfDeath ? deathOf(p.killerCharacter, lastHit(p.causeOfDeath, p.killerCharacter, l)) : null,
  };
};

// character는 dak.gg 이름표의 영문 key
export function readDak(dir: string): { gameId: number; rank: number; character: string; dak: KelDak }[] {
  let files: string[];
  try {
    files = games(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("[kel] dak.gg 경기 상세 폴더를 읽지 못함", e);
    return [];
  }
  let keys: Map<number, string>;
  let characterNames: Map<string, string>;
  let ids: Map<string, number>;
  try {
    const list = JSON.parse(readFileSync(join(dir, CHARACTERS), "utf8")).characters as { id: number; key: string; name?: string }[];
    keys = new Map(list.map((c) => [c.id, c.key]));
    ids = new Map(list.map((c) => [c.key, c.id]));
    characterNames = new Map(list.map((c) => [c.key, c.name ?? ""]));
  } catch (e) {
    console.error("[kel] dak.gg 실험체 이름표를 읽지 못함", e);
    return [];
  }
  const areas = names(dir, AREAS, "areas", "id");
  const weathers = names(dir, WEATHERS, "weathers", "key");
  const l = { ...labels(dir), names: characterNames, ids };
  return files.flatMap((f) => {
    try {
      const game: { games: Player[]; skillInfos?: { userNum: number; orders?: string[] }[] } = JSON.parse(readFileSync(join(dir, GAMES, f), "utf8"));
      const orders = new Map((game.skillInfos ?? []).map((s) => [s.userNum, s.orders ?? []]));
      return game.games.map((p) => ({ gameId: p.gameId, rank: p.gameRank, character: keys.get(p.characterNum) ?? "", dak: pick(p, l, orders.get(p.userNum ?? -1) ?? [], areas, weathers) }));
    } catch (e) {
      console.error(`[kel] dak.gg ${f}를 읽지 못함`, e);
      return [];
    }
  });
}

// 명단의 한 줄. round는 dak.gg recent-games code의 끝 두 자리
export type Scheduled = { gameId: number; event: string; stage: string; round: number };

export type DakPlayer = Scheduled & {
  date: string;
  rank: number;
  nickname: string;
  // dak.gg 이름표의 영문 key
  character: string;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  taken: number;
  rankScore: number;
  killScore: number;
};

type Base = { gameRank: number; teamNumber: number; nickname: string; characterNum: number; playerKill: number; playerDeaths: number; playerAssistant: number; damageToPlayer: number; damageFromPlayer: number; startDtm: string };
type Score = { teamNumber: number; rankScore: number; killScore: number };

// 명단에 있고 skip에 없는 게임만 선수 기록으로 바꿈
export function readScheduled(dir: string, skip: Set<number>): DakPlayer[] {
  let list: Scheduled[];
  let keys: Map<number, string>;
  try {
    list = JSON.parse(readFileSync(join(dir, SCHEDULE), "utf8"));
    keys = new Map((JSON.parse(readFileSync(join(dir, CHARACTERS), "utf8")).characters as { id: number; key: string }[]).map((c) => [c.id, c.key]));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("[kel] dak.gg 경기 명단을 읽지 못함", e);
    return [];
  }
  return list
    .filter((g) => !skip.has(g.gameId))
    .flatMap((g) => {
      try {
        const game: { games: Base[]; scoreInfos: Score[] } = JSON.parse(readFileSync(join(dir, GAMES, `${g.gameId}.json`), "utf8"));
        const scores = new Map(game.scoreInfos.map((s) => [s.teamNumber, s]));
        return game.games.map((p) => ({
          ...g,
          // startDtm은 +0900 시각이라 앞 10자가 서울 날짜
          date: p.startDtm.slice(0, 10),
          rank: p.gameRank,
          nickname: p.nickname.trim(),
          character: keys.get(p.characterNum) ?? "",
          kills: p.playerKill,
          deaths: p.playerDeaths,
          assists: p.playerAssistant,
          damage: p.damageToPlayer,
          taken: p.damageFromPlayer,
          rankScore: scores.get(p.teamNumber)?.rankScore ?? 0,
          killScore: scores.get(p.teamNumber)?.killScore ?? 0,
        }));
      } catch (e) {
        console.error(`[kel] dak.gg ${g.gameId} 경기 상세를 읽지 못함`, e);
        return [];
      }
    });
}
