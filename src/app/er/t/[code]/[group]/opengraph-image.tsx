import { openView } from "@/er/server/http";
import { groupIndex } from "@/er/lib/view";
import { OG_SIZE, boardImage } from "@/er/server/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "대회 순위표";
export const dynamic = "force-dynamic";

export default async function Image({ params }: { params: Promise<{ code: string; group: string }> }) {
  const { code, group } = await params;
  const { view } = await openView(code, null, group, "og", 120);
  return boardImage(view, view ? Math.max(0, groupIndex(view, group)) : 0);
}
