import type { NextRequest } from "next/server";
import { botAuthorized, botRelay } from "@/er/server/board";
import { fail, handle, json, readJson } from "@/er/server/http";
import { allow } from "@/limits";

type Body = { channelId?: unknown; actor?: unknown; fileName?: unknown; data?: unknown };

// 몽실봇 전용. 토큰이 없으면 주소가 없는 것처럼 응답하고, 그 밖의 결과는 모두 200으로 보내 봇이 status로 가름
export async function POST(req: NextRequest) {
  return handle(async () => {
    if (!botAuthorized(req.headers.get("x-bot-token"))) return new Response(null, { status: 404 });
    if (!allow("bot", 1200, 60_000)) return fail("요청이 너무 많습니다.", 429);
    const body = (await readJson<Body>(req).catch(() => null)) ?? {};
    return json(botRelay(body.channelId, body.actor, body.fileName, body.data));
  });
}
