import type { NextRequest } from "next/server";
import { BASE_URL } from "@/er/server/auth";
import { fail, guardWrite, handle, json, readJson } from "@/er/server/http";
import { issueUploadKey, loadView, revokeUploadKey, uploadKeys } from "@/er/server/tournament";
import { uploadScript } from "@/er/server/upload-script";

type Ctx = { params: Promise<{ code: string }> };
type Body = { action: "issue" | "revoke"; group?: number };

// 발급 응답에만 키와 키를 넣은 스크립트가 있음. 다시 받으려면 폐기하고 새로 발급
export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const { code } = await ctx.params;
    const body = await readJson<Body>(req);
    if (body.action === "issue") {
      const { key, label } = issueUploadKey(code, g.user, body.group);
      const view = loadView(code, null)!;
      const title = view.groupCount > 1 ? `${view.name} ${label}조` : view.name;
      const script = uploadScript({ url: `${BASE_URL}/api/upload/${view.code}/${label.toLowerCase()}`, key, title });
      return json({ keys: uploadKeys(code, g.user), key, script, file: `labs-upload-${view.code}-${label.toLowerCase()}.ps1` });
    }
    if (body.action === "revoke") {
      revokeUploadKey(code, g.user, body.group);
      return json({ keys: uploadKeys(code, g.user) });
    }
    return fail("알 수 없는 요청입니다.");
  });
}
