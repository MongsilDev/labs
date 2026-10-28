import { NextResponse, type NextRequest } from "next/server";
import { BASE_URL, SESSION_COOKIE, cookieOptions, deleteSessions, safeNext, sameOrigin } from "@/er/server/auth";

export async function POST(req: NextRequest) {
  if (!(await sameOrigin())) return new NextResponse(null, { status: 403 });
  const sid = req.cookies.get(SESSION_COOKIE)?.value;
  if (sid) deleteSessions(sid);
  const form = await req.formData().catch(() => null);
  const next = safeNext(form?.get("next")?.toString());
  // 대회 관리는 로그아웃 상태로 열면 로그인으로 보냄
  const res = NextResponse.redirect(`${BASE_URL}${/^\/er\/t\/[^/]+\/manage/.test(next) ? "/er/score" : next}`, 303);
  res.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return res;
}
