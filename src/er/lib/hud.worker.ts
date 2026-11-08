import { HUD_H, HUD_W, readCards, type CardRead } from "./hud";

// 화면 공유 영상은 탭이 뒤에 있어도 멈추지 않도록 워커에서 프레임을 받아 읽음
export type WorkerIn = { type: "stream"; readable: ReadableStream<VideoFrame>; every: number } | { type: "bitmap"; bitmap: ImageBitmap };
export type WorkerOut = { type: "cards"; cards: CardRead[]; width: number; height: number; ms: number } | { type: "ended" } | { type: "error"; message: string };

let ctx: OffscreenCanvasRenderingContext2D | null = null;

function read(src: CanvasImageSource, width: number, height: number): WorkerOut {
  const t = performance.now();
  ctx ??= new OffscreenCanvas(HUD_W, HUD_H).getContext("2d", { willReadFrequently: true });
  if (!ctx) return { type: "error", message: "캔버스를 만들지 못했습니다." };
  ctx.drawImage(src, 0, 0, HUD_W, HUD_H);
  const cards = readCards(ctx.getImageData(0, 0, HUD_W, HUD_H));
  return { type: "cards", cards, width, height, ms: performance.now() - t };
}

async function stream(readable: ReadableStream<VideoFrame>, every: number) {
  const reader = readable.getReader();
  let last = -Infinity;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const t = performance.now();
    if (t - last >= every) {
      last = t;
      postMessage(read(value, value.displayWidth, value.displayHeight));
    }
    value.close();
  }
  postMessage({ type: "ended" } satisfies WorkerOut);
}

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === "stream") stream(m.readable, m.every).catch((err: unknown) => postMessage({ type: "error", message: String(err) } satisfies WorkerOut));
  else {
    postMessage(read(m.bitmap, m.bitmap.width, m.bitmap.height));
    m.bitmap.close();
  }
};
