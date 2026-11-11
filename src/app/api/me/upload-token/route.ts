import type { NextRequest } from "next/server";
import { autoConfig } from "@/er/server/autoUpload";
import { BASE_URL, currentUser } from "@/er/server/auth";
import { fail, guardWrite, handle, json, readJson } from "@/er/server/http";
import { issueUploadToken, revokeUploadToken, uploadTokenInfo } from "@/er/server/tournament";
import { watchScript } from "@/er/server/watchScript";
import { allow } from "@/limits";

type Body = { action: "issue" | "revoke" };

export async function GET() {
  return handle(async () => {
    const user = await currentUser();
    if (!user) return fail("디스코드로 로그인해주세요.", 401);
    return json({ token: uploadTokenInfo(user), ship: autoConfig().ship });
  });
}

// 토큰 평문은 발급 응답에만 있음. ship이 file이면 토큰을 채운 감시 파일을, paste면 붙여 넣을 토큰과 빈 감시 파일을 줌
export async function POST(req: NextRequest) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const body = await readJson<Body>(req);
    if (body.action === "issue") {
      if (!allow(`tok:${g.user.id}`, 5, 60 * 60_000)) return fail("요청이 너무 많습니다. 잠시 뒤 다시 시도해주세요.", 429);
      const value = issueUploadToken(g.user);
      const ship = autoConfig().ship;
      const script = watchScript({ token: ship === "file" ? value : "", url: `${BASE_URL}/api/upload/me` });
      return json({ token: uploadTokenInfo(g.user), ship, value: ship === "paste" ? value : undefined, script, fileName: "labs-watch.cmd" });
    }
    if (body.action === "revoke") {
      revokeUploadToken(g.user);
      return json({ token: null });
    }
    return fail("알 수 없는 요청입니다.");
  });
}
