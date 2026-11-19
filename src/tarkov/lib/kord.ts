import seasons from "@/tarkov/data/seasons.json";
import type { Season } from "./build";

export type { Perk, Season } from "./build";

export const SEASONS = (seasons as Season[]).toSorted((a, b) => a.start - b.start);
export const LATEST = SEASONS.at(-1)!;
export const seasonBySlug = (slug: string) => SEASONS.find((s) => s.slug === slug);

// 가장 최근 시즌은 /tarkov/season, 지난 시즌은 시즌 이름 주소에 남김
export const seasonPath = (s: Season) => (s === LATEST ? "/tarkov/season" : `/tarkov/${s.slug}`);
export const seasonTitle = (s: Season) => s.name.toUpperCase();

// 시작한 시즌 가운데 가장 최근 것. 다음 시즌 데이터가 시작 전에 올라와도 비교군은 지금 시즌 기준
export const seasonAt = (t: number) => SEASONS.findLast((s) => s.start <= t) ?? SEASONS[0];

// 시즌을 넘어 같은 id가 이어질 수 있어, 고른 특성이 모두 있는 시즌 중 활동 시각이 든 시즌을 고름
export function seasonOfPerks(ids: string[], at: number | null): Season | undefined {
  const fit = SEASONS.filter((s) => ids.every((id) => s.personal.some((p) => p.id === id)));
  return (at == null ? undefined : fit.findLast((s) => s.start <= at)) ?? fit.at(-1);
}

// 특성 조합이 정해진 시즌 업적만. 몇 개를 고르는 업적은 조합이 하나로 정해지지 않아 뺌
const ACHIEVEMENT_BUILDS: Record<string, [string, string[]][]> = {
  "kord-breach": [
    ["6a5df752accb14ca770ccb07", ["69c3cd003ffdba4e68086bd7", "69c3cddcfb79911cf20022d6", "69c3d2acfe3c5632e4045fe8", "69c3d6a9af28f094100fe128", "69ce62886e199f4bbe0ab19b"]],
    ["6a5dfd7b5c12f0b8a80c453c", ["69c3da13eaf97663fb0bb36d", "69c3da8fc0e4deb02605f3c9"]],
    ["6a5df6b0c901d2199d017048", ["69ce64fe6e199f4bbe0ab1a1"]],
    ["6a5dfed95c12f0b8a80c4545", ["69c40cb782362c4aff041510"]],
  ],
};

export const presets = (season: Season, names: Record<string, { name: string }>) =>
  (ACHIEVEMENT_BUILDS[season.slug] ?? [])
    .filter(([a, ids]) => names[a] && ids.every((id) => season.personal.some((p) => p.id === id)))
    .map(([a, ids]) => ({ name: names[a].name, ids }));

export type Preset = ReturnType<typeof presets>[number];
