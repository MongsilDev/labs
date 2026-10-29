import type { NextRequest } from "next/server";
import { boardVersion, botAuthorized, botBoard, scrimAuthorized } from "@/er/server/board";
import { fail, handle, json } from "@/er/server/http";
import { allow } from "@/limits";

type Ctx = { params: Promise<{ code: string }> };

// 몽실봇과 스크림봇 전용. 토큰이 없으면 주소가 없는 것처럼 응답
export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const token = req.headers.get("x-bot-token");
    if (!botAuthorized(token) && !scrimAuthorized(token)) return new Response(null, { status: 404 });
    if (!allow(scrimAuthorized(token) ? "scrim-read" : "bot", 1200, 60_000)) return fail("요청이 너무 많습니다.", 429);
    const { code } = await ctx.params;
    const q = req.nextUrl.searchParams;
    const since = Number(q.get("since"));
    if (since) {
      const v = boardVersion(code);
      if (v === null) return fail("없거나 지워진 대회입니다.", 404);
      if (v === since) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    const board = botBoard(code, q.get("group"), q.get("user"));
    if (board === null) return fail("없거나 지워진 대회입니다.", 404);
    if (board === "no-group") return fail("없는 조입니다.", 400);
    return json(board);
  });
}
