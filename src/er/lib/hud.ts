import { GLYPHS } from "./hud-glyphs";

// 관전 화면 아래쪽 팀 카드 8개의 TS, KS와 탈락 표시 읽기. 좌표는 1920x1080 기준이라 부르는 쪽이 그 크기로 그려서 넘김
export const HUD_W = 1920;
export const HUD_H = 1080;

export type Rgba = { data: Uint8ClampedArray | Uint8Array; width: number; height: number };
export type CardRead = { slot: number; ts: number | null; ks: number | null; raised: boolean; out: boolean; color: string | null };
export type Glyphs = Record<string, { p: Float32Array; w: number }>;
type Blob = { x0: number; x1: number; y0: number; y1: number };
type Row = { band: Float32Array; w: number; thr: number; items: { b: Blob; dot: boolean }[] };

export const CARD_X = [10, 188, 366, 544, 722, 900, 1078, 1256];
export const DIGIT_TOP = 858;
export const RAISED = -30;
const STRIP = { left: 56, right: 178 };
const BAND = { above: 3, rows: 16 };
const SKULL_X = [31, 87, 142];
const SKULL_Y = 924;
// TS 글자 아래 팀 색 줄. 숫자 윗선에서 15~19줄 아래이고 방송마다 다름
const COLOR = { dy0: 11, dy1: 22, x0: 4, x1: 164, step: 4, spread: 60 };
export const GLYPH_W = 8;
export const GLYPH_H = 12;
const DIGIT_ROWS = 8;
const MIN_SCORE = 0.55;
const MIN_MARGIN = 0.06;

const lumAt = (img: Rgba, x: number, y: number) => {
  const k = (y * img.width + x) * 4;
  return 0.299 * img.data[k] + 0.587 * img.data[k + 1] + 0.114 * img.data[k + 2];
};

// 카드 윗줄의 흰 숫자와 소수점. 회색 TS, KS 글자는 문턱 아래로 버림
export function glyphRow(img: Rgba, cardX: number, top: number): Row | null {
  const x0 = cardX + STRIP.left;
  const y0 = top - BAND.above;
  const w = STRIP.right - STRIP.left;
  const h = BAND.rows;
  const band = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) band[j * w + i] = lumAt(img, x0 + i, y0 + j);
  const sorted = Float32Array.from(band).sort();
  const bg = sorted[Math.floor(sorted.length * 0.5)];
  const peak = sorted[Math.floor(sorted.length * 0.98)];
  if (peak - bg < 70 || bg > 120) return null;
  const thr = bg + 0.6 * (peak - bg);
  const runs: Blob[] = [];
  let cur: Blob | null = null;
  for (let i = 0; i < w; i++) {
    let lo = -1;
    let hi = -1;
    for (let j = 0; j < h; j++)
      if (band[j * w + i] > thr) {
        if (lo < 0) lo = j;
        hi = j;
      }
    if (lo < 0) {
      if (cur) runs.push(cur);
      cur = null;
    } else if (cur) {
      cur.x1 = i + 1;
      cur.y0 = Math.min(cur.y0, lo);
      cur.y1 = Math.max(cur.y1, hi + 1);
    } else cur = { x0: i, x1: i + 1, y0: lo, y1: hi + 1 };
  }
  if (cur) runs.push(cur);
  const all = runs.flatMap((b) => split(b, band, w, thr));
  const tall = all.filter((b) => b.y1 - b.y0 >= DIGIT_ROWS && b.y0 + GLYPH_H <= h);
  if (tall.length < 2) return null;
  const bottom = tall.map((b) => b.y1).sort((a, b) => a - b)[tall.length >> 1];
  // 소수점은 아래가 숫자와 맞고 양옆 4픽셀 안에 숫자가 있는 작은 점. 나머지 작은 덩어리는 버림
  const items = all.flatMap((b) => {
    if (tall.includes(b)) return [{ b, dot: false }];
    const dot =
      b.y1 - b.y0 <= 4 &&
      b.x1 - b.x0 <= 4 &&
      Math.abs(b.y1 - bottom) <= 1 &&
      tall.some((t) => t.x1 <= b.x0 && b.x0 - t.x1 <= 4) &&
      tall.some((t) => t.x0 >= b.x1 && t.x0 - b.x1 <= 4);
    return dot ? [{ b, dot: true }] : [];
  });
  return { band, w, thr, items };
}

// 붙어 버린 두 숫자는 가장 어두운 열에서 나눔
function split(b: Blob, band: Float32Array, w: number, thr: number): Blob[] {
  if (b.x1 - b.x0 < 14) return [b];
  let best = -1;
  let bestSum = Infinity;
  for (let i = b.x0 + 4; i < b.x1 - 4; i++) {
    let s = 0;
    for (let j = b.y0; j < b.y1; j++) s += Math.max(0, band[j * w + i] - thr);
    if (s < bestSum) {
      bestSum = s;
      best = i;
    }
  }
  return [...split({ ...b, x1: best }, band, w, thr), ...split({ ...b, x0: best + 1 }, band, w, thr)];
}

// 숫자 칸을 GLYPH_W x GLYPH_H로 늘이거나 줄이고 평균 0, 길이 1로 맞춤
export function patch(row: Row, b: Blob): Float32Array {
  const { band, w } = row;
  const out = new Float32Array(GLYPH_W * GLYPH_H);
  const bw = b.x1 - b.x0;
  for (let j = 0; j < GLYPH_H; j++)
    for (let i = 0; i < GLYPH_W; i++) {
      const sx = b.x0 + ((i + 0.5) * bw) / GLYPH_W - 0.5;
      const x0 = Math.max(b.x0, Math.min(b.x1 - 1, Math.floor(sx)));
      const x1 = Math.min(b.x1 - 1, x0 + 1);
      const f = Math.max(0, Math.min(1, sx - x0));
      const y = b.y0 + j;
      out[j * GLYPH_W + i] = band[y * w + x0] * (1 - f) + band[y * w + x1] * f;
    }
  let mean = 0;
  for (const v of out) mean += v;
  mean /= out.length;
  let norm = 0;
  for (let k = 0; k < out.length; k++) {
    out[k] -= mean;
    norm += out[k] * out[k];
  }
  norm = Math.sqrt(norm) || 1;
  for (let k = 0; k < out.length; k++) out[k] /= norm;
  return out;
}

// 6과 8처럼 닮은 숫자는 1위와 2위 점수 차가 작으면 읽지 않은 것으로 둠
function classify(p: Float32Array, width: number, glyphs: Glyphs): { ch: string; score: number; margin: number } {
  let ch = "?";
  let score = -1;
  let second = -1;
  for (const [c, g] of Object.entries(glyphs)) {
    let s = 0;
    for (let k = 0; k < p.length; k++) s += p[k] * g.p[k];
    s -= Math.abs(width - g.w) * 0.04;
    if (s > score) {
      second = score;
      score = s;
      ch = c;
    } else if (s > second) second = s;
  }
  return { ch, score, margin: score - second };
}

// 숫자 사이가 가장 넓은 곳이 KS 글자 자리. 그 자리와 첫 숫자 앞에 회색 글자가 없으면 카드 윗줄이 아님
export function readPair(img: Rgba, cardX: number, top: number, glyphs: Glyphs = GLYPHS, minMargin = MIN_MARGIN): { ts: number; ks: number } | null {
  const row = glyphRow(img, cardX, top);
  if (!row) return null;
  const { items } = row;
  let at = -1;
  let gap = 0;
  for (let i = 1; i < items.length; i++) {
    const g = items[i].b.x0 - items[i - 1].b.x1;
    if (g > gap) {
      gap = g;
      at = i;
    }
  }
  if (gap < 12) return null;
  if (!label(row, items[at - 1].b.x1, items[at].b.x0)) return null;
  if (!label(row, Math.max(0, items[0].b.x0 - 22), items[0].b.x0)) return null;
  const texts: string[] = [];
  for (const group of [items.slice(0, at), items.slice(at)]) {
    let s = "";
    for (const { b, dot } of group) {
      if (dot) {
        s += ".";
        continue;
      }
      const c = classify(patch(row, b), b.x1 - b.x0, glyphs);
      if (c.score < MIN_SCORE || c.margin < minMargin) return null;
      s += c.ch;
    }
    texts.push(s);
  }
  const [ts, ks] = texts.map(value);
  if (ts === null || ks === null) return null;
  // TS는 KS에 순위 점수(0~10 정수)를 더한 값
  const rank = Math.round((ts - ks) * 10) / 10;
  if (rank < 0 || rank > 10 || !Number.isInteger(rank)) return null;
  return { ts, ks };
}

const value = (s: string): number | null => (/^\d{1,2}(\.[05])?$/.test(s) ? Number(s) : null);

function label(row: Row, x0: number, x1: number): boolean {
  const { band, w, thr } = row;
  let n = 0;
  for (let j = 0; j < band.length / w; j++)
    for (let i = x0; i < x1; i++) {
      const v = band[j * w + i];
      if (v > 85 && v < thr) n++;
    }
  return n >= 10;
}

// 초상 위 붉은 마름모 안의 흰 해골. 부활 대기의 X 원 표시는 제외
export function skull(img: Rgba, cx: number, cy: number): boolean {
  let red = 0;
  let white = 0;
  let n = 0;
  for (let y = cy - 9; y <= cy + 9; y++)
    for (let x = cx - 10; x <= cx + 10; x++) {
      const k = (y * img.width + x) * 4;
      const r = img.data[k];
      const g = img.data[k + 1];
      const b = img.data[k + 2];
      n++;
      if (r > 140 && r - g > 70 && r - b > 50) red++;
      else if (r > 185 && g > 170 && b > 170) white++;
    }
  return red / n > 0.18 && white / n > 0.35;
}

/** 카드 윗줄 아래 팀 색 줄의 색. 가장 밝은 줄을 색 줄로 보고, 색이 고르지 않으면 가려진 것으로 보고 null */
export function cardColor(img: Rgba, cardX: number, top: number): string | null {
  const xs: number[] = [];
  for (let x = cardX + COLOR.x0; x <= cardX + COLOR.x1; x += COLOR.step) xs.push(x);
  const at = (x: number, y: number) => (y * img.width + x) * 4;
  let y = -1;
  let best = -1;
  for (let dy = COLOR.dy0; dy <= COLOR.dy1; dy++) {
    let v = 0;
    for (const x of xs) {
      const k = at(x, top + dy);
      v += Math.max(img.data[k], img.data[k + 1], img.data[k + 2]);
    }
    if (v > best) {
      best = v;
      y = top + dy;
    }
  }
  const mid = (a: number[]) => [...a].sort((p, q) => p - q)[a.length >> 1];
  const lum = xs.map((x) => lumAt(img, x, y)).sort((p, q) => p - q);
  if (lum[Math.floor(lum.length * 0.9)] - lum[Math.floor(lum.length * 0.1)] > COLOR.spread) return null;
  return `#${[0, 1, 2].map((c) => mid(xs.map((x) => img.data[at(x, y) + c])).toString(16).padStart(2, "0")).join("")}`;
}

export function readCards(img: Rgba, glyphs: Glyphs = GLYPHS, minMargin = MIN_MARGIN): CardRead[] {
  if (img.width !== HUD_W || img.height !== HUD_H) throw new Error(`이미지 크기가 1920x1080이 아닙니다: ${img.width}x${img.height}`);
  return CARD_X.map((x, i) => {
    const normal = readPair(img, x, DIGIT_TOP, glyphs, minMargin);
    const up = normal ? null : readPair(img, x, DIGIT_TOP + RAISED, glyphs, minMargin);
    const pair = normal ?? up;
    const raised = !normal && !!up;
    const dy = raised ? RAISED : 0;
    const out = SKULL_X.every((sx) => skull(img, x + sx, SKULL_Y + dy));
    const color = pair ? cardColor(img, x, DIGIT_TOP + dy) : null;
    return { slot: i + 1, ts: pair?.ts ?? null, ks: pair?.ks ?? null, raised, out, color };
  });
}
