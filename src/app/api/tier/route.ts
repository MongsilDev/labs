import { fail, json } from "@/er/server/http";
import { cachedTier, NICKNAME, tierOf } from "@/er/server/rank";
import { allow, clientIp } from "@/limits";

export const dynamic = "force-dynamic";

const NEW_PER_MIN = 30;

export async function GET(req: Request) {
  const n = new URL(req.url).searchParams.get("n")?.trim() ?? "";
  if (!NICKNAME.test(n)) return fail("닉네임을 확인해주세요.", 400);
  const ip = await clientIp();
  // 방송 화면은 1분에 한 번 부르므로, IP마다 분당 30회와 처음 보는 닉네임 전체 분당 30개로 막음
  if (!allow(`tier-ip:${ip}`, 30, 60_000) || (!cachedTier(n) && !allow("tier-new", NEW_PER_MIN, 60_000)))
    return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
  const r = await tierOf(n);
  if (r.ok) return json(r.data);
  if (r.status === 404) return fail("닉네임을 찾지 못했습니다.", 404);
  if (r.status === 429) return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
  return fail("티어를 불러오지 못했습니다.", 503);
}
