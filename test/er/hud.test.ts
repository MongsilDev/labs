import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cardColor, DIGIT_TOP, HUD_H, HUD_W, readCards } from "@/er/lib/hud";

// 중계 장면은 레포에 넣지 않아서, 장면 폴더가 있는 기기에서만 인식률을 잼
const DIR = process.env.HUD_FRAMES ?? "/Volumes/SSD/ov291";
const has = existsSync(join(DIR, "label/truth.json"));

type Truth = { frames: Record<string, { raised: number; cards: string[]; out: number[] }>; empty: string[] };

async function load(name: string) {
  const { data, info } = await sharp(join(DIR, `${name}.jpg`)).resize(HUD_W, HUD_H, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

describe("관전 화면 카드 읽기", () => {
  it("카드가 없는 화면에서는 아무 값도 읽지 않음", () => {
    const img = { data: new Uint8ClampedArray(HUD_W * HUD_H * 4), width: HUD_W, height: HUD_H };
    expect(readCards(img).every((c) => c.ts === null && c.ks === null && !c.out)).toBe(true);
  });

  it("카드 윗줄 아래에서 가장 밝은 줄의 색을 팀 색으로 읽고, 고르지 않으면 버림", () => {
    const img = { data: new Uint8ClampedArray(HUD_W * HUD_H * 4), width: HUD_W, height: HUD_H };
    const paint = (y: number, x0: number, x1: number, rgb: number[]) => {
      for (let x = x0; x <= x1; x++) img.data.set([...rgb, 255], (y * HUD_W + x) * 4);
    };
    paint(DIGIT_TOP + 15, 10, 180, [185, 42, 64]);
    expect(cardColor(img, 10, DIGIT_TOP)).toBe("#b92a40");
    paint(DIGIT_TOP + 15, 100, 180, [20, 20, 20]);
    expect(cardColor(img, 10, DIGIT_TOP)).toBeNull();
  });

  it("1920x1080이 아닌 이미지는 받지 않음", () => {
    expect(() => readCards({ data: new Uint8ClampedArray(4), width: 1, height: 1 })).toThrow();
  });

  it.skipIf(!has)("정답표 장면에서 틀린 값 없이 읽음", async () => {
    const truth = JSON.parse(readFileSync(join(DIR, "label/truth.json"), "utf8")) as Truth;
    let right = 0;
    let wrong = 0;
    let outs = 0;
    let cards = 0;
    for (const [name, t] of Object.entries(truth.frames)) {
      const reads = readCards(await load(name));
      reads.forEach((r, i) => {
        const [ts, ks] = t.cards[i].split("/").map(Number);
        cards++;
        if (r.ts === ts && r.ks === ks) right++;
        else if (r.ts !== null) wrong++;
        if (r.out === t.out.includes(i + 1)) outs++;
      });
    }
    for (const name of truth.empty) expect(readCards(await load(name)).filter((r) => r.ts !== null)).toEqual([]);
    expect(wrong).toBe(0);
    expect(outs).toBe(cards);
    expect(right / cards).toBeGreaterThanOrEqual(0.95);
  }, 30_000);
});
