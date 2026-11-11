// 팬키트에 그림이 없는 아이템만 dak.gg에서 한 번 받아 다른 아이템 아이콘과 같은 100x56 webp로 저장. 수집기가 부르지 않는 수동 스크립트
// 사용: node scripts/er/tier/dakicons.mjs 202412 116409 103404
// 저장한 코드는 src/er/lib/tier.ts ITEM_ICON에 넣어야 화면에 그림이 나옴
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT = join(import.meta.dirname, "../../../public/img/er/item");
const codes = process.argv.slice(2).map(Number).filter((c) => c > 0);
if (!codes.length) throw new Error("받을 아이템 코드를 적어주세요.");
const todo = codes.filter((c) => !existsSync(join(OUT, `${c}.v1.webp`)));
if (!todo.length) {
  console.log("모두 이미 있어 요청하지 않습니다");
  process.exit(0);
}

const get = async (url) => {
  const res = await fetch(url, { headers: { "user-agent": "agent-local" }, signal: AbortSignal.timeout(20_000) });
  if (res.status !== 200) throw new Error(`${url} ${res.status}`);
  return res;
};
const { items } = await (await get("https://er.dakgg.io/api/v1/data/items?hl=ko")).json();
for (const c of todo) {
  const it = items.find((x) => x.id === c);
  if (!it?.imageUrl) {
    console.log(c, "dak.gg 목록에 그림이 없습니다");
    continue;
  }
  await new Promise((r) => setTimeout(r, 3000));
  const png = Buffer.from(await (await get(it.imageUrl.startsWith("//") ? `https:${it.imageUrl}` : it.imageUrl)).arrayBuffer());
  // sharp는 withMetadata를 부르지 않으면 EXIF와 텍스트 청크를 쓰지 않음
  await sharp(png).resize(100, 56, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 86, alphaQuality: 90 }).toFile(join(OUT, `${c}.v1.webp`));
  console.log(c, it.name, "저장");
}
