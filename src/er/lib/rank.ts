export type RankView = {
  nickname: string;
  tier: string;
  mmr: number;
  place: string;
  serverRank: number | null;
  serverCode: number | null;
  last: { gain: number; at: number | null } | null;
  recent: number[];
  updatedAt: number;
};

// 팬키트 08. Rank Tier 파일 이름. 파일은 알파 128 초과 범위로 자른 높이 240 사본
const EMBLEMS: [string, string][] = [
  ["이터니티", "Immortal"],
  ["데미갓", "Titan"],
  ["미스릴", "Mithril"],
  ["메테오라이트", "Meteorite"],
  ["다이아몬드", "Diamond"],
  ["플래티넘", "Platinum"],
  ["골드", "Gold"],
  ["실버", "Silver"],
  ["브론즈", "Bronze"],
  ["아이언", "Iron"],
];

const family = (tier: string) => EMBLEMS.find(([k]) => k === tier.split(" ")[0])?.[1];

/** 티어 이름의 엠블럼 주소. "메테오라이트 3"은 Meteorite */
export const rankEmblem = (tier: string) => `/img/er/emblem/${family(tier) ?? "Unrank"}.v1.webp`;

export const isRanked = (tier: string) => !!family(tier);

export const SERVER_NAMES: Record<number, string> = { 10: "아시아1", 12: "북미", 13: "유럽", 14: "남미", 17: "아시아2", 18: "아시아3" };

export type PresetKey = "t1" | "t2" | "t3";
type Preset = { x0: number; y0: number; x1: number; y1: number; anchor: "bl" | "tr" | "tl" };

// 1920x1080에서 칠해진 첫 픽셀과 마지막 픽셀. 기준선과 4px 간격은 ~/plans/overlay/redesign.html 5번 표
export const PRESETS: Record<PresetKey, Preset> = {
  // 시간 표시 윗선 y 1057과 게임 현황 창 왼쪽 x 296에서 4씩 띄움. 아래 끝 기준이라 최근 줄이 없으면 위가 줄어듦
  t1: { x0: 4, y0: 920, x1: 291, y1: 1052, anchor: "bl" },
  // 팀 수 표시와 같은 y 13~44, RP 원 왼쪽 x 1647에서 4. 오른쪽 끝 기준이고 x0은 가장 긴 글자일 때
  t2: { x0: 1347, y0: 13, x1: 1642, y1: 44, anchor: "tr" },
  // 팀 수 표시 오른쪽 x 1275와 교체 버튼 x 1553에서 4, 퀘스트 창 y 106까지 4
  t3: { x0: 1280, y0: 13, x1: 1548, y1: 101, anchor: "tl" },
};

export type Place = { preset: PresetKey; left?: number; right?: number; top?: number; bottom?: number; scale?: number };

const int = (v: string | undefined) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 프리셋 자리에 x, y만큼 옮긴 위치. 1920 기준 픽셀이고 패널이 화면 밖으로 나가지 않게 막음 */
export function overlayPlace(p: string | undefined, x?: string, y?: string, scale?: string): Place {
  // p 없이 scale만 있는 주소는 소스를 카드 크기로 잡던 프리셋 이전 설정이라 왼쪽 위에 그 배율로 그림
  if (p === undefined && scale !== undefined) return { preset: "t1", left: 8, top: 8, scale: clamp(Number(scale) || 1, 0.5, 3) };
  const preset: PresetKey = p === "t2" || p === "t3" ? p : "t1";
  const g = PRESETS[preset];
  const dx = clamp(int(x), -g.x0, 1919 - g.x1);
  const dy = clamp(int(y), -g.y0, 1079 - g.y1);
  if (g.anchor === "bl") return { preset, left: g.x0 + dx, bottom: 1079 - g.y1 - dy };
  if (g.anchor === "tr") return { preset, right: 1919 - g.x1 - dx, top: g.y0 + dy };
  return { preset, left: g.x0 + dx, top: g.y0 + dy };
}
