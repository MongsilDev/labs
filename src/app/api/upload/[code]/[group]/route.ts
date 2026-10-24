import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { NextRequest } from "next/server";
import { LIMITS } from "@/er/lib/rules";
import { handle, json } from "@/er/server/http";
import { uploadKeyId, uploadWithKey } from "@/er/server/tournament";
import { limitKey } from "@/ip";
import { allow } from "@/limits";

type Ctx = { params: Promise<{ code: string; group: string }> };

const STATUS = { added: 200, duplicate: 409, invalid: 422, ended: 410 } as const;
const hidden = () => new Response(null, { status: 404 });
const limited = () => json({ status: "limited", message: "요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요." }, 429, { "Retry-After": "60" });

// 업로드 스크립트 전용. 로그인 쿠키와 Origin 대신 조마다 발급한 키로 받고, 키가 맞지 않으면 주소가 없는 것처럼 응답
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const ip = limitKey(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local");
    if (!allow(`up-ip:${ip}`, 60, 60_000)) return limited();
    const { code, group } = await ctx.params;
    const key = req.headers.get("x-upload-key") ?? "";
    const id = uploadKeyId(code, group, key);
    if (!id) return hidden();
    if (!allow(`up:${id}`, 10, 60_000)) return limited();
    if (Number(req.headers.get("content-length") ?? 0) > LIMITS.csvBytes) return tooLarge();
    const bytes = await readBody(req);
    if (!bytes) return tooLarge();
    const name = (req.headers.get("x-file-name") ?? "").slice(0, 120) || "GameResult_.csv";
    const r = uploadWithKey(code, group, key, { name, text: decode(bytes) });
    if (r.status === "gone") return hidden();
    return json({ status: r.status, message: r.message }, STATUS[r.status]);
  });
}

const tooLarge = () => json({ status: "invalid", message: "200KB가 넘는 파일은 올릴 수 없습니다." }, 413);

async function readBody(req: Request): Promise<Buffer | null> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (req.body)
    for await (const chunk of req.body as NodeReadableStream<Uint8Array>) {
      size += chunk.length;
      if (size > LIMITS.csvBytes) return null;
      chunks.push(chunk);
    }
  return Buffer.concat(chunks);
}

// 게임 CSV는 UTF-8이지만 메모장 등으로 저장해 UTF-16이 된 파일도 읽음
const decode = (b: Buffer) => (b[0] === 0xff && b[1] === 0xfe ? new TextDecoder("utf-16le") : new TextDecoder()).decode(b);
