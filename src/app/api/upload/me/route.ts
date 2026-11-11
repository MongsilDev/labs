import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import type { NextRequest } from "next/server";
import { decodeCsv } from "@/er/lib/csv";
import { LIMITS } from "@/er/lib/rules";
import { handle, json } from "@/er/server/http";
import { uploadWithToken } from "@/er/server/tournament";
import { hash } from "@/er/server/auth";
import { allow, blocked, ipOf, miss } from "@/limits";

const STATUS = { added: 200, duplicate: 409, invalid: 422, ended: 410, gone: 401 } as const;

// 감시 창은 응답 본문을 그대로 화면에 찍으므로 text/plain을 달라고 하면 문장만 돌려줌
function reply(req: NextRequest, status: keyof typeof STATUS | "limited" | "large", message: string) {
  const code = status === "limited" ? 429 : status === "large" ? 413 : STATUS[status];
  const headers: Record<string, string> = status === "limited" ? { "Retry-After": "60" } : {};
  if ((req.headers.get("accept") ?? "").includes("text/plain"))
    return new Response(message, { status: code, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers } });
  return json({ status: status === "large" ? "invalid" : status, message }, code, headers);
}

// 감시 창 전용. 로그인 쿠키와 Origin 대신 사용자마다 발급한 토큰으로 받음
export async function POST(req: NextRequest) {
  return handle(async () => {
    const ip = ipOf(req.headers);
    if (blocked(ip) || !allow(`up-ip:${ip}`, 60, 60_000)) return reply(req, "limited", "요청이 너무 많습니다. 잠시 뒤 다시 보냅니다.");
    const value = req.headers.get("x-upload-token") ?? "";
    if (!value || !allow(`up-tok:${hash(value)}`, 10, 60_000)) return value ? reply(req, "limited", "요청이 너무 많습니다. 잠시 뒤 다시 보냅니다.") : gone(req, ip);
    if (Number(req.headers.get("content-length") ?? 0) > LIMITS.csvBytes) return reply(req, "large", "200KB가 넘는 파일은 올릴 수 없습니다.");
    const bytes = await readBody(req);
    if (!bytes) return reply(req, "large", "200KB가 넘는 파일은 올릴 수 없습니다.");
    const r = uploadWithToken(value, { name: "GameResult_.csv", text: decodeCsv(bytes) });
    if (r.status === "gone") return gone(req, ip);
    return reply(req, r.status, r.message);
  });
}

function gone(req: NextRequest, ip: string) {
  miss(ip);
  return reply(req, "gone", "토큰이 폐기됐습니다. Labs에서 새 토큰을 받아주세요.");
}

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
