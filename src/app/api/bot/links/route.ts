import type { NextRequest } from "next/server";
import { botAuthorized } from "@/er/server/board";
import { fail, handle, json } from "@/er/server/http";
import { allBotLinks } from "@/er/server/tournament";
import { allow } from "@/limits";

// 몽실봇 전용. 봇이 켜질 때 끝나지 않은 대회의 연결 전체를 받음
export async function GET(req: NextRequest) {
  return handle(async () => {
    if (!botAuthorized(req.headers.get("x-bot-token"))) return new Response(null, { status: 404 });
    if (!allow("bot", 1200, 60_000)) return fail("요청이 너무 많습니다.", 429);
    return json({ links: allBotLinks() });
  });
}
