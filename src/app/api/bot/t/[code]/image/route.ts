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
    // ImageResponse는 본문을 읽을 때 그려서, 렌더 오류가 200 응답으로 나가지 않게 먼저 다 읽음
    // info는 안내 메시지용 대회 정보 이미지. 순위 없이 방식과 개최자만 그림
    const q = req.nextUrl.searchParams;
    const info = q.get("info") === "1";
    const image = info
      ? roundImage({ ...board, standings: [], played: 0, ended: false }, (q.get("host") || board.host?.name || "").slice(0, 64))
      : roundImage(board);
    const png = await (await image).arrayBuffer();
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
  });
}
