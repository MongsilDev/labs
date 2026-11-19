import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeBuild, encodeBuild, type Season } from "@/tarkov/lib/build";
import { LATEST, SEASONS, presets, seasonAt, seasonBySlug, seasonOfPerks, seasonPath } from "@/tarkov/lib/kord";

const KORD = seasonBySlug("kord-breach")!;
const UNTAR = seasonBySlug("untar-control")!;
const sorted = KORD.personal.map((p) => p.id).sort();

const fake = (n: number, slug = "fake"): Season => ({
  id: slug,
  slug,
  name: slug,
  start: 0,
  end: 0,
  common: [],
  personal: Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(2, "0")}`, name: "", en: "", effects: [] })),
});

describe("빌드 코드", () => {
  it("시즌 특성 목록으로 왕복 복원", () => {
    expect(encodeBuild(KORD, [sorted[0]])).toBe("1");
    expect(decodeBuild(KORD, "1")).toEqual([sorted[0]]);
    expect(decodeBuild(KORD, encodeBuild(KORD, sorted))).toEqual(sorted);
    expect(decodeBuild(KORD, encodeBuild(KORD, [sorted[1], sorted.at(-1)!]))).toEqual([sorted[1], sorted.at(-1)]);
  });

  it("시즌 1 옛 주소의 코드는 예전과 같은 특성으로 풀림", () => {
    // 53비트 숫자로 만들던 예전 코드와 같은 값
    const old = (ids: string[]) => sorted.reduce((n, id, i) => (ids.includes(id) ? n + 2 ** i : n), 0).toString(36);
    for (const ids of [[sorted[0]], [sorted[3], sorted[20], sorted.at(-1)!], sorted]) {
      expect(encodeBuild(KORD, ids)).toBe(old(ids));
      expect(decodeBuild(KORD, old(ids))).toEqual(ids);
    }
  });

  it("형식이 틀리거나 특성 수를 넘는 코드는 빈 선택", () => {
    expect(decodeBuild(KORD, "")).toEqual([]);
    expect(decodeBuild(KORD, "A1")).toEqual([]);
    expect(decodeBuild(KORD, "-1")).toEqual([]);
    expect(decodeBuild(KORD, (BigInt(2) ** BigInt(sorted.length)).toString(36))).toEqual([]);
    expect(decodeBuild(KORD, "z".repeat(100))).toEqual([]);
  });

  it("53개를 넘는 시즌도 왕복 복원", () => {
    const s = fake(64);
    const ids = s.personal.map((p) => p.id);
    for (const sel of [[ids[52]], [ids[53]], [ids[63]], [ids[0], ids[53], ids[63]], ids]) {
      expect(decodeBuild(s, encodeBuild(s, sel))).toEqual(sel);
    }
  });
});

describe("시즌", () => {
  it("가장 최근 시즌만 /tarkov/season", () => {
    expect(LATEST).toBe(SEASONS.at(-1));
    expect(seasonPath(LATEST)).toBe("/tarkov/season");
    for (const s of SEASONS.slice(0, -1)) expect(seasonPath(s)).toBe(`/tarkov/${s.slug}`);
  });

  it("시작 전 시각은 첫 시즌, 시작 뒤는 그 시즌", () => {
    expect(seasonAt(0)).toBe(SEASONS[0]);
    expect(seasonAt(KORD.start)).toBe(KORD);
  });

  it("시즌 2가 현재 시즌이지만 시즌 1 기록 시각은 시즌 1로 판별", () => {
    expect(LATEST).toBe(UNTAR);
    // 시즌 2 시작일이 미정이라 시즌 1 종료 시각을 시작으로 둠
    expect(UNTAR.start).toBe(KORD.end);
    expect(seasonAt(KORD.end - 1)).toBe(KORD);
  });

  it("고른 특성으로 시즌을 찾고, 없는 특성이 섞이면 못 찾음", () => {
    const underdog = KORD.personal.find((p) => p.en === "Underdog")!.id;
    const hemophilia = KORD.personal.find((p) => p.en === "Hemophilia")!.id;
    expect(seasonOfPerks([underdog], null)).toBe(KORD);
    expect(seasonOfPerks([hemophilia], KORD.end - 1)).toBe(KORD);
    expect(seasonOfPerks([hemophilia], null)).toBe(UNTAR);
    expect(seasonOfPerks([UNTAR.personal.find((p) => p.en === "Lockpicker")!.id], null)).toBe(UNTAR);
    expect(seasonOfPerks([sorted[0], "없는 id"], null)).toBeUndefined();
  });

  it("시즌 데이터는 배타 관계가 같은 시즌 안을 가리키고 아이콘이 있거나 빈 자리로 표시", () => {
    for (const s of SEASONS) {
      const ids = new Set(s.personal.map((p) => p.id));
      expect(ids.size).toBe(s.personal.length);
      for (const p of s.personal) for (const x of [...(p.exclusive ?? []), ...(p.guess ?? [])]) expect(ids.has(x)).toBe(true);
      // 추정 상충은 공식 데이터가 없는 시즌에만 둠
      if (!s.preview) expect(s.personal.some((p) => p.guess)).toBe(false);
      for (const p of [...s.common, ...s.personal]) expect(p.icon === false || existsSync(`public/kord/perks/${p.id}.png`)).toBe(true);
    }
    expect(UNTAR.personal.filter((p) => p.points! < 0)).toHaveLength(31);
    expect(UNTAR.personal.filter((p) => p.points! > 0)).toHaveLength(25);
    expect(UNTAR.common).toHaveLength(6);
  });

  it("업적 프리셋은 그 시즌에만", () => {
    const names = { "6a5df6b0c901d2199d017048": { name: "업적" } };
    expect(presets(KORD, names)).toHaveLength(1);
    expect(presets(fake(3), names)).toEqual([]);
  });
});
