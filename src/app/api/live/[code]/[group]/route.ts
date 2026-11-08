import { currentUser } from "@/er/server/auth";
import { fail, guardWrite, handle, json, readJson } from "@/er/server/http";
import { getLive, setLive } from "@/er/server/live";
import { liveGroup } from "@/er/server/tournament";
import { parseFrame } from "@/er/lib/live";
import { allow, blocked, clientIp, miss } from "@/limits";

type Ctx = { params: Promise<{ code: string; group: string }> };

const GONE = "없는 대회이거나 이 대회의 운영자가 아닙니다.";

// 방송 상자가 1초마다 부름. 대회 한 행만 읽고 경기 중 값만 돌려줌
export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { code, group } = await ctx.params;
    const ip = await clientIp();
    if (blocked(ip)) return fail("없는 대회 코드로 너무 많이 요청했습니다. 잠시 뒤 다시 시도해주세요.", 429);
    if (!allow(`live:${ip}`, 300, 60_000)) return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
    const at = liveGroup(code, await currentUser(), group);
    if (!at) {
      miss(ip);
      return fail("없거나 지워진 대회입니다.", 404);
    }
    return json({ frame: getLive(at.code, at.group) });
  });
}

// 읽기 탭이 바뀐 값을 보냄. 개최자와 운영자만, 조마다 초당 2회
export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const { code, group } = await ctx.params;
    const at = liveGroup(code, g.user, group);
    if (!at?.operator) return fail(GONE, 404);
    if (!allow(`live-w:${at.code}:${at.group}`, 2, 1000)) return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
    const frame = parseFrame(await readJson(req));
    if (!frame) return fail("요청 형식이 잘못됐습니다.", 400);
    const { played } = at;
    if (frame.roundNo <= played) return fail(`${frame.roundNo}라운드 결과가 이미 등록되어 있습니다.`, 409);
    setLive(at.code, at.group, frame);
    return json({ ok: true, played });
  });
}
