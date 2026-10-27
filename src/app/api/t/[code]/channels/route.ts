import type { NextRequest } from "next/server";
import { currentUser } from "@/er/server/auth";
import { allow, blocked, clientIp, miss } from "@/limits";
import { discordChannels, OpError } from "@/er/server/tournament";
import { fail, handle, json } from "@/er/server/http";

type Ctx = { params: Promise<{ code: string }> };

// 관리 화면의 디스코드 채널 목록. 몽실봇에 물어 그 사용자가 고를 수 있는 채널만 돌려주고, 봇을 부르지 못하면 guilds가 null
export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) return fail("디스코드로 로그인해주세요.", 401);
    const { code } = await ctx.params;
    const ip = await clientIp();
    if (!allow(`channels:${ip}`, 120, 60_000) || blocked(ip)) return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
    try {
      return json({ guilds: await discordChannels(code, user) });
    } catch (e) {
      if (e instanceof OpError) miss(ip);
      throw e;
    }
  });
}
