export type TierView = {
  nickname: string;
  tier: string;
  mmr: number;
  place: string;
  serverRank: number | null;
  serverCode: number | null;
  last: { gain: number; at: number | null } | null;
  updatedAt: number;
};

const FAMILIES: { name: string; short: string; color: string }[] = [
  { name: "이터니티", short: "E", color: "#e84c7d" },
  { name: "데미갓", short: "DG", color: "#d9a24a" },
  { name: "미스릴", short: "MI", color: "#c06ef0" },
  { name: "메테오라이트", short: "M", color: "#7a7cf5" },
  { name: "다이아몬드", short: "D", color: "#5ab4f5" },
  { name: "플래티넘", short: "P", color: "#3fc7c0" },
  { name: "골드", short: "G", color: "#e6b84a" },
  { name: "실버", short: "S", color: "#b9c2cf" },
  { name: "브론즈", short: "B", color: "#b0805a" },
  { name: "아이언", short: "I", color: "#8a8f99" },
];
const UNRANKED = { short: "-", color: "#4a5263" };

/** 티어 이름의 약자와 색. "메테오라이트 3"은 M3 */
export function tierBadge(tier: string): { short: string; color: string } {
  const [name, div] = tier.split(" ");
  const f = FAMILIES.find((x) => x.name === name);
  if (!f) return UNRANKED;
  return { short: `${f.short}${/^[1-4]$/.test(div ?? "") ? div : ""}`, color: f.color };
}

export const SERVER_NAMES: Record<number, string> = { 10: "아시아1", 12: "북미", 13: "유럽", 14: "남미", 17: "아시아2", 18: "아시아3" };
