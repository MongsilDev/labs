import type { NextRequest } from "next/server";
import { botAuthorized } from "@/er/server/board";
import { fail, handle, json, readJson } from "@/er/server/http";
import { botLinks, setDiscordLinks } from "@/er/server/tournament";
import { allow } from "@/limits";

type Ctx = { params: Promise<{ code: string }> };

const STATUS = { ok: 200, gone: 404, forbidden: 403, invalid: 400 } as const;

// 몽실봇 전용. 토큰이 없으면 주소가 없는 것처럼 응답
export async function PUT(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    if (!botAuthorized(req.headers.get("x-bot-token"))) return new Response(null, { status: 404 });
    if (!allow("bot", 1200, 60_000)) return fail("요청이 너무 많습니다.", 429);
    const { code } = await ctx.params;
    const body = await readJson<{ actor?: unknown; links?: unknown }>(req).catch(() => null);
    if (!body) return json({ status: "invalid" }, 400);
    const r = setDiscordLinks(code, body.actor, body.links);
    return json(r, STATUS[r.status]);
  });
}

// 몽실봇 전용. 대회의 연결을 다시 받아 봇의 사본을 맞출 때 씀
export async function GET(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    if (!botAuthorized(req.headers.get("x-bot-token"))) return new Response(null, { status: 404 });
    if (!allow("bot", 1200, 60_000)) return fail("요청이 너무 많습니다.", 429);
    const { code } = await ctx.params;
    const r = botLinks(code);
    return json(r, r.status === "ok" ? 200 : 404);
  });
}
