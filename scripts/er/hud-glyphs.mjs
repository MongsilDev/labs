// 관전 화면 숫자 템플릿 만들기와 인식률 재기. 프레임과 정답표는 레포 밖에 둠
// node scripts/er/hud-glyphs.mjs <프레임 폴더> [--write]
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

registerHooks({
  resolve(spec, ctx, next) {
    try {
      return next(spec, ctx);
    } catch (e) {
      if (spec.startsWith(".")) return next(`${spec}.ts`, ctx);
      throw e;
    }
  },
});
const hud = await import("../../src/er/lib/hud.ts");

const dir = process.argv[2];
const write = process.argv.includes("--write");
const margin = Number(process.argv.find((a) => a.startsWith("--margin="))?.slice(9) ?? NaN) || undefined;
const truth = JSON.parse(readFileSync(join(dir, "label/truth.json"), "utf8"));

const via = Number(process.argv.find((a) => a.startsWith("--via="))?.slice(6) ?? 0);
async function load(name, via = 0) {
  let src = sharp(join(dir, `${name}.jpg`));
  // --via=1280이면 시험 프레임만 그 폭으로 줄였다가 다시 늘려 해상도가 다른 화면 공유를 흉내 냄. 템플릿은 원본에서 만듦
  if (via) src = sharp(await src.resize(via, Math.round((via * 9) / 16), { fit: "fill" }).png().toBuffer());
  const { data, info } = await src.resize(hud.HUD_W, hud.HUD_H, { fit: "fill" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width: info.width, height: info.height };
}

const frames = {};
const tests = {};
for (const name of [...Object.keys(truth.frames), ...truth.empty]) {
  frames[name] = await load(name);
  tests[name] = via ? await load(name, via) : frames[name];
}

// 프레임마다 글자 표본: [{frame, ch, p, w}]
const samples = [];
for (const [name, t] of Object.entries(truth.frames)) {
  const img = frames[name];
  t.cards.forEach((pair, i) => {
    const top = hud.DIGIT_TOP + (t.raised === i + 1 ? hud.RAISED : 0);
    const row = hud.glyphRow(img, hud.CARD_X[i], top);
    const chars = pair.replace("/", "").split("");
    const n = row?.items.length ?? 0;
    if (!row || n !== chars.length) return console.log(`건너뜀 ${name} ${i + 1}: 덩어리 ${n}, 글자 ${chars.length}`);
    row.items.forEach(({ b, dot }, k) => {
      if (dot !== (chars[k] === ".")) return;
      if (!dot) samples.push({ frame: name, ch: chars[k], p: hud.patch(row, b), w: b.x1 - b.x0 });
    });
  });
}

function build(except) {
  const acc = {};
  for (const s of samples) {
    if (s.frame === except) continue;
    const a = (acc[s.ch] ??= { p: new Float32Array(s.p.length), w: 0, n: 0 });
    for (let k = 0; k < s.p.length; k++) a.p[k] += s.p[k];
    a.w += s.w;
    a.n++;
  }
  const glyphs = {};
  for (const [ch, a] of Object.entries(acc)) {
    let norm = 0;
    for (const v of a.p) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    glyphs[ch] = { p: a.p.map((v) => v / norm), w: a.w / a.n, n: a.n };
  }
  return glyphs;
}

const fmt = (v) => (v === null ? "-" : Number.isInteger(v) ? String(v) : v.toFixed(1));
let numbers = 0, right = 0, missing = 0, wrong = 0, cards = 0, cardsRight = 0, outRight = 0;
for (const [name, t] of Object.entries(truth.frames)) {
  const glyphs = build(name);
  const reads = hud.readCards(tests[name], glyphs, margin);
  const line = [];
  reads.forEach((r, i) => {
    const [ts, ks] = t.cards[i].split("/").map(Number);
    cards++;
    for (const [got, want] of [[r.ts, ts], [r.ks, ks]]) {
      numbers++;
      if (got === null) missing++;
      else if (got === want) right++;
      else wrong++;
    }
    if (r.ts === ts && r.ks === ks) cardsRight++;
    if (r.out === t.out.includes(i + 1)) outRight++;
    const ok = (r.ts === ts && r.ks === ks ? "" : r.ts === null ? "?" : "!") + (r.out === t.out.includes(i + 1) ? "" : "#");
    line.push(`${i + 1}:${fmt(r.ts)}/${fmt(r.ks)}${r.raised ? "^" : ""}${r.out ? "x" : ""}${ok}`);
  });
  console.log(name.padEnd(18), line.join(" "));
}
let falseReads = 0;
for (const name of truth.empty) {
  const reads = hud.readCards(tests[name], build(null), margin);
  const got = reads.filter((r) => r.ts !== null);
  falseReads += got.length;
  console.log(name.padEnd(18), got.length ? got.map((r) => `${r.slot}:${fmt(r.ts)}/${fmt(r.ks)}`).join(" ") : "읽은 값 없음");
}
console.log(`숫자 ${numbers}개: 맞음 ${right}, 못 읽음 ${missing}, 틀림 ${wrong}. 카드 ${cards}개 중 두 값 모두 맞음 ${cardsRight}, 탈락 판정 맞음 ${outRight}. 빈 화면에서 읽은 카드 ${falseReads}개`);

if (write) {
  const glyphs = build(null);
  const body = Object.entries(glyphs)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ch, g]) => `  "${ch}": g(${g.w.toFixed(2)}, "${Buffer.from(Int8Array.from(g.p, (v) => Math.round(v * 400))).toString("base64")}"),`)
    .join("\n");
  const file = `import type { Glyphs } from "./hud";

// scripts/er/hud-glyphs.mjs가 KEL 중계와 내전 장면 ${Object.keys(truth.frames).length}장에서 만든 숫자 템플릿
const g = (w: number, b64: string) => {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const p = Float32Array.from(new Int8Array(raw.buffer), (v) => v / 400);
  let n = 0;
  for (const v of p) n += v * v;
  n = Math.sqrt(n) || 1;
  return { p: p.map((v) => v / n), w };
};

export const GLYPHS: Glyphs = {
${body}
};
`;
  writeFileSync(new URL("../../src/er/lib/hud-glyphs.ts", import.meta.url), file);
  console.log("hud-glyphs.ts에 씀:", Object.entries(glyphs).map(([c, g]) => `${c}(${g.n})`).join(" "));
}
