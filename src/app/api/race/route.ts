import { getCut } from "@/er/server/cut";
import { json } from "@/er/server/http";
import { getRace } from "@/er/server/race";

export const dynamic = "force-dynamic";

/** 이터런 목록. 화면이 1분마다 다시 받음(장부 552). 닫혔거나 낡았으면 null */
export async function GET() {
  const cut = await getCut();
  return json(cut ? await getRace(cut.season.id) : null);
}
