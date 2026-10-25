import type { NextRequest } from "next/server";
import { fail, guardWrite, handle, json, readJson } from "@/er/server/http";
import { issueUploadKey, revokeUploadKey, uploadKeys } from "@/er/server/tournament";

type Ctx = { params: Promise<{ code: string }> };
type Body = { action: "issue" | "revoke"; group?: number };

// 키 평문은 발급 응답에만 있음. 다시 받으려면 폐기하고 새로 발급
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const { code } = await ctx.params;
    const body = await readJson<Body>(req);
    if (body.action === "issue") {
      const { key } = issueUploadKey(code, g.user, body.group);
      return json({ keys: uploadKeys(code, g.user), key });
    }
    if (body.action === "revoke") {
      revokeUploadKey(code, g.user, body.group);
      return json({ keys: uploadKeys(code, g.user) });
    }
    return fail("알 수 없는 요청입니다.");
  });
}
