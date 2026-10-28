// 서킷 순위는 bori.wiki 대회 결과 표, 배점과 일정은 2026-10-12 시행 규정집 기준

// short는 좁은 화면 열지도에 쓰는 연고지 두 글자
export type KelTeam = { key: string; name: string; short: string; csv: string; wiki: string; circuits: [number, number, number, number]; dark?: boolean };

export const KEL_TEAMS: KelTeam[] = [
  { key: "gc-busan-stella", name: "GC 부산 스텔라", short: "부산", csv: "GC Busan Stella", wiki: "GC_BUSAN_Stella", circuits: [3, 3, 1, 11] },
  { key: "daejeon-autoarms", name: "대전 오토암즈", short: "대전", csv: "DAEJEON AutoArms", wiki: "DAEJEON_AutoArms", circuits: [7, 1, 3, 3] },
  { key: "incheon-wave", name: "인천 웨이브", short: "인천", csv: "INCHEON WAVE", wiki: "INCHEON_WAVE", circuits: [13, 7, 4, 1] },
  { key: "gyeongbuk-ascenders", name: "경북 어센더스", short: "경북", csv: "Gyeongbuk Ascenders", wiki: "GyeongBuk_Ascenders", circuits: [1, 5, 9, 7] },
  { key: "gyeongnam-sparkle", name: "경남 스파클", short: "경남", csv: "Gyeongnam Sparkle Esports", wiki: "Gyeongnam_Sparkle", circuits: [4, 6, 10, 2] },
  { key: "seongnam-rox", name: "성남 락스", short: "성남", csv: "Seongnam ROX", wiki: "Seongnam_ROX", circuits: [10, 2, 6, 5] },
  { key: "chungnam-cnj", name: "충남 CNJ", short: "충남", csv: "Chungnam CNJ Esports", wiki: "Chungnam_CNJ", circuits: [9, 10, 2, 9] },
  { key: "new-rise-gangwon", name: "뉴 라이즈 강원", short: "강원", csv: "New Rise Gangwon", wiki: "New_Rise_Gangwon", circuits: [5, 14, 8, 4] },
  { key: "jeonnam-esports", name: "전남 이스포츠", short: "전남", csv: "Jeonnam Esports", wiki: "JEONNAM_ESPORTS", circuits: [16, 4, 5, 12] },
  { key: "daegu-guardians", name: "대구 가디언즈", short: "대구", csv: "Daegu Guardians", wiki: "Daegu_Guardians", circuits: [2, 9, 16, 13] },
  { key: "fn-sejong", name: "FN 세종", short: "세종", csv: "FN SEJONG", wiki: "FN_SEJONG", circuits: [11, 12, 12, 6], dark: true },
  { key: "gyeonggi-innate", name: "경기 이네이트", short: "경기", csv: "Gyeonggi Innate", wiki: "Gyeonggi_Innate", circuits: [8, 8, 7, 16] },
  { key: "gj-slasher", name: "광주 슬래셔", short: "광주", csv: "GJ Slasher", wiki: "GJ_Slasher", circuits: [6, 15, 15, 10] },
  { key: "yj-whales", name: "양주 웨일즈", short: "양주", csv: "YJ Whales", wiki: "Yangju_Whales", circuits: [14, 13, 14, 8] },
  { key: "jeju-shadow", name: "제주 쉐도우", short: "제주", csv: "Jeju Shadow", wiki: "Jeju_Shadow", circuits: [15, 11, 11, 14] },
  { key: "goyang-mir", name: "고양 미르", short: "고양", csv: "Goyang Mir", wiki: "Goyang_MIR", circuits: [12, 16, 13, 15] },
];

export const TEAM = new Map(KEL_TEAMS.map((t) => [t.key, t]));
export const TEAM_BY_CSV = new Map(KEL_TEAMS.map((t) => [t.csv, t]));

export const WIKI = "https://bori.wiki";
export const LOGO_CDN = "https://cdn.mongsil.dev/er-labs/teams";
export const DAKGG = "https://dak.gg/er/esports/kel_2026";
// KEL 사이트는 HTTPS 접속을 받지 않음
export const RULES = "http://kel.e-sports.or.kr/notice/view/1334";

export const wikiUrl = (title: string) => `${WIKI}/${encodeURIComponent(title.replace(/ /g, "_"))}`;

// 차트 강조 3색, 값은 globals.css의 --kel-1~3
export const TONES = ["var(--kel-1)", "var(--kel-2)", "var(--kel-3)"];

// 영문과 숫자는 읽는 소리의 받침으로 고름
export function josa(word: string, withFinal: string, without: string): string {
  const c = word.trim().slice(-1);
  const code = c.charCodeAt(0) - 0xac00;
  const final = code >= 0 && code <= 11171 ? code % 28 !== 0 : /[lmnr013678]/i.test(c);
  return word + (final ? withFinal : without);
}

// 마지막 칸은 9~12위 공통, 13위부터 0점
export const CIRCUIT_POINTS: Record<"early" | "late", number[]> = { early: [800, 480, 320, 240, 200, 160, 120, 80, 40], late: [1200, 720, 480, 360, 300, 240, 180, 120, 60] };

export function circuitPoints(circuit: number, rank: number): number {
  const table = circuit <= 2 ? CIRCUIT_POINTS.early : CIRCUIT_POINTS.late;
  if (rank <= 8) return table[rank - 1];
  return rank <= 12 ? table[8] : 0;
}

export type SeasonRow = { team: KelTeam; points: number[]; total: number; rank: number };

// 포인트가 같으면 서킷 4 순위가 높은 팀이 위
export function seasonStandings(): SeasonRow[] {
  return KEL_TEAMS.map((team) => {
    const points = team.circuits.map((rank, i) => circuitPoints(i + 1, rank));
    return { team, points, total: points.reduce((a, b) => a + b, 0), rank: 0 };
  })
    .sort((a, b) => b.total - a.total || a.team.circuits[3] - b.team.circuits[3])
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export const FINAL_ROUNDS = 9;

// 시즌 순위로 가르는 결승 직행과 준결승 진출 기준
export const SEEDS = 4;
export const QUALIFY = 12;

export function championshipTeams() {
  const season = seasonStandings();
  return { seeds: season.slice(0, SEEDS).map((r) => r.team), semi: season.slice(SEEDS, QUALIFY).map((r) => r.team) };
}

export const KEL_EVENTS = [
  { key: "opening", name: "오프닝 위크", dates: "5.22~5.23" },
  { key: "c1", name: "서킷 1", dates: "6.6~6.14" },
  { key: "c2", name: "서킷 2", dates: "7.4~7.12" },
  { key: "msc", name: "미드 시즌 컵", dates: "8.1~8.2" },
  { key: "c3", name: "서킷 3", dates: "9.12~9.20" },
  { key: "c4", name: "서킷 4", dates: "10.10~10.18" },
] as const;

export type KelEvent = (typeof KEL_EVENTS)[number]["key"];
export const EVENT_NAME = Object.fromEntries(KEL_EVENTS.map((e) => [e.key, e.name])) as Record<KelEvent, string>;

export type KelScreen = "home" | "odds" | "rules" | "circuits" | "finals" | "teams" | "regions" | "players" | "roles" | "kills" | "characters" | "comps" | "records";

// public이 false인 화면은 KEL_OWNER_ID 계정만 열 수 있음
export const KEL_SCREENS: Record<KelScreen, { path: string; title: string; public: boolean }> = {
  home: { path: "/er/kel", title: "2026 KEL 기록", public: true },
  odds: { path: "/er/kel/odds", title: "챔피언십 진출 확률", public: true },
  rules: { path: "/er/kel/rules", title: "포맷과 규칙", public: true },
  circuits: { path: "/er/kel/circuits", title: "서킷별 순위", public: true },
  finals: { path: "/er/kel/finals", title: "결승 라운드별 점수", public: true },
  teams: { path: "/er/kel/teams", title: "팀 성향", public: true },
  regions: { path: "/er/kel/regions", title: "시작 지역과 사망 지역", public: true },
  players: { path: "/er/kel/players", title: "선수 카드", public: true },
  roles: { path: "/er/kel/roles", title: "팀 안에서 맡은 역할", public: true },
  kills: { path: "/er/kel/kills", title: "처치 관계", public: true },
  characters: { path: "/er/kel/characters", title: "실험체", public: true },
  comps: { path: "/er/kel/comps", title: "많이 등장한 3인 조합", public: true },
  records: { path: "/er/kel/records", title: "한 게임 기록", public: true },
};

export const kelVisible = (screen: KelScreen, owner: boolean) => owner || KEL_SCREENS[screen].public;

export const playerPath = (name: string) => `${KEL_SCREENS.players.path}?p=${encodeURIComponent(name)}`;

// 첫 화면의 묶음. 하위 화면 아래에는 같은 묶음의 다른 화면 링크를 둠
export const KEL_SECTIONS: { title: string; items: KelScreen[] }[] = [
  { title: "챔피언십", items: ["odds", "rules"] },
  { title: "경기", items: ["finals", "records"] },
  { title: "선수", items: ["players", "roles", "kills"] },
  { title: "팀", items: ["circuits", "teams", "regions"] },
  { title: "실험체와 조합", items: ["characters", "comps"] },
];
