import type { NextRequest } from "next/server";
import { currentUser } from "@/er/server/auth";
import { fail, guardWrite, handle, json, readJson } from "@/er/server/http";
import { autoUploadOf, setAutoUpload } from "@/er/server/tournament";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const user = await currentUser();
    if (!user) return fail("디스코드로 로그인해주세요.", 401);
    const { code } = await ctx.params;
    return json({ on: autoUploadOf(code, user) });
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return handle(async () => {
    const g = await guardWrite();
    if ("error" in g) return g.error;
    const { code } = await ctx.params;
    const body = await readJson<{ on?: unknown }>(req);
    if (typeof body.on !== "boolean") return fail("알 수 없는 요청입니다.");
    setAutoUpload(code, g.user, body.on);
    return json({ on: autoUploadOf(code, g.user) });
  });
}
