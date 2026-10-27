import type { NextRequest } from "next/server";
import { currentUser } from "@/er/server/auth";
import { allow, blocked, clientIp, miss } from "@/limits";
import { applyOp, deleteTournament, linkDiscord, loadView, tournamentVersion } from "@/er/server/tournament";
import { fail, guardWrite, handle, json, readJson } from "@/er/server/http";
import type { Op } from "@/er/lib/view";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const { code } = await ctx.params;
    const ip = await clientIp();
    if (!allow(`get:${ip}`, 600, 60_000)) return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
    if (blocked(ip)) return fail("없는 대회 코드를 너무 많이 열었습니다. 잠시 뒤 다시 시도해주세요.", 429);
    const since = Number(req.nextUrl.searchParams.get("since"));
    if (since) {
      const v = tournamentVersion(code);
      if (v === null) {
        miss(ip);
        return fail("없거나 지워진 대회입니다.", 404);
      }
      if (v === since) return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    const view = loadView(code, await currentUser());
    if (!view) {
      miss(ip);
      return fail("없거나 지워진 대회입니다.", 404);
    }
    return json(view);
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const { code } = await ctx.params;
    const op = await readJson<Op>(req);
    // 채널 연결은 몽실봇의 채널 목록을 확인해야 해서 따로 처리
    if (op.op === "link_discord") return json(await linkDiscord(code, g.user, op.group, op.channelId));
    return json(applyOp(code, g.user, op));
  });
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const { code } = await ctx.params;
    const body = await readJson<{ confirm?: string }>(req);
    deleteTournament(code, g.user, body.confirm ?? "");
    return json({ ok: true });
  });
}
