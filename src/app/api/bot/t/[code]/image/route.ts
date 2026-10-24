import type { NextRequest } from "next/server";
import { botAuthorized, botBoard } from "@/er/server/board";
import { fail, handle } from "@/er/server/http";
import { roundImage } from "@/er/server/round-og";
import { allow } from "@/limits";

type Ctx = { params: Promise<{ code: string }> };

// 몽실봇 전용. 토큰이 없으면 주소가 없는 것처럼 응답
export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    if (!botAuthorized(req.headers.get("x-bot-token"))) return new Response(null, { status: 404 });
    if (!allow("bot", 1200, 60_000)) return fail("요청이 너무 많습니다.", 429);
    const { code } = await ctx.params;
    const board = botBoard(code, req.nextUrl.searchParams.get("group"), null);
    if (board === null) return fail("없거나 지워진 대회입니다.", 404);
    if (board === "no-group") return fail("없는 조입니다.", 400);
    const img = await roundImage(board);
    img.headers.set("Cache-Control", "no-store");
    return img;
  });
}
