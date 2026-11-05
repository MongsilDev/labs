import season from "@/tarkov/data/season.json";

export type Perk = { id: string; name: string; en: string; effects: string[]; points?: number; exclusive?: string[] };

export const COMMON = season.common as Perk[];
export const PERSONAL = season.personal as Perk[];
export const PERK = new Map(PERSONAL.map((p) => [p.id, p]));

// 주소에는 선택 여부를 비트로 묶어 36진수로 넣음. id 앞부분이 생성 시각이라 새 특성은 뒤 비트에 배정됨, 53개까지
const ORDER = PERSONAL.map((p) => p.id).sort();

export const encodeBuild = (sel: Iterable<string>) => {
  const set = new Set(sel);
  return ORDER.reduce((n, id, i) => (set.has(id) ? n + 2 ** i : n), 0).toString(36);
};

export function decodeBuild(raw: string) {
  const v = /^[0-9a-z]{1,11}$/.test(raw) ? parseInt(raw, 36) : 0;
  const n = Number.isSafeInteger(v) ? v : 0;
  return ORDER.filter((_, i) => Math.floor(n / 2 ** i) % 2 === 1);
}

// 특성 조합이 정해진 시즌 업적만. 몇 개를 고르는 업적은 조합이 하나로 정해지지 않아 뺌
const ACHIEVEMENT_BUILDS: [string, string[]][] = [
  ["6a5df752accb14ca770ccb07", ["69c3cd003ffdba4e68086bd7", "69c3cddcfb79911cf20022d6", "69c3d2acfe3c5632e4045fe8", "69c3d6a9af28f094100fe128", "69ce62886e199f4bbe0ab19b"]],
  ["6a5dfd7b5c12f0b8a80c453c", ["69c3da13eaf97663fb0bb36d", "69c3da8fc0e4deb02605f3c9"]],
  ["6a5df6b0c901d2199d017048", ["69ce64fe6e199f4bbe0ab1a1"]],
  ["6a5dfed95c12f0b8a80c4545", ["69c40cb782362c4aff041510"]],
];

export const presets = (names: Record<string, { name: string }>) =>
  ACHIEVEMENT_BUILDS.filter(([a, ids]) => names[a] && ids.every((id) => PERK.has(id))).map(([a, ids]) => ({ name: names[a].name, ids }));

export type Preset = ReturnType<typeof presets>[number];
