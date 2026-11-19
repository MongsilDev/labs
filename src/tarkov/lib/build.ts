// guess는 공식 상충이 나오기 전 시즌 1 규칙으로 추정한 상충. refdata가 공식 데이터로 시즌을 통째로 바꾸면 사라짐
export type Perk = { id: string; name: string; en: string; effects: string[]; points?: number; exclusive?: string[]; guess?: string[]; icon?: false };
export type Season = { id: string; slug: string; name: string; start: number; end: number; common: Perk[]; personal: Perk[]; preview?: string };

// 주소에는 시즌의 개인 특성 id를 정렬한 순서로 선택 여부를 비트로 묶어 36진수로 넣음. 53개를 넘을 수 있어 BigInt로 계산
const ZERO = BigInt(0);
const ONE = BigInt(1);
const B36 = BigInt(36);
const order = (season: Season) => season.personal.map((p) => p.id).sort();

export function encodeBuild(season: Season, sel: Iterable<string>) {
  const set = new Set(sel);
  return order(season)
    .reduce((n, id, i) => (set.has(id) ? n | (ONE << BigInt(i)) : n), ZERO)
    .toString(36);
}

export function decodeBuild(season: Season, raw: string) {
  const ids = order(season);
  if (!/^[0-9a-z]+$/.test(raw) || raw.length > Math.ceil(ids.length / Math.log2(36)) + 1) return [];
  const n = [...raw].reduce((v, c) => v * B36 + BigInt(parseInt(c, 36)), ZERO);
  if (n >> BigInt(ids.length) !== ZERO) return [];
  return ids.filter((_, i) => ((n >> BigInt(i)) & ONE) === ONE);
}
