import type { NextRequest } from "next/server";
import { scrimAuthorized } from "@/er/server/board";
import { fail, handle, json, readJson } from "@/er/server/http";
import { createScrim, type ScrimInput } from "@/er/server/tournament";
import { allow } from "@/limits";

const STATUS = { ok: 200, forbidden: 403, invalid: 400, full: 409 } as const;

// 스크림봇 전용. 토큰이 없으면 주소가 없는 것처럼 응답
export async function POST(req: NextRequest) {
  return handle(async () => {
    if (!scrimAuthorized(req.headers.get("x-bot-token"))) return new Response(null, { status: 404 });
    if (!allow("scrim", 30, 60 * 60 * 1000)) return fail("요청이 너무 많습니다.", 429);
    const body = await readJson<ScrimInput>(req).catch(() => null);
    if (!body) return json({ status: "invalid" }, 400);
    const r = createScrim(body);
    return json(r, STATUS[r.status]);
  });
}
