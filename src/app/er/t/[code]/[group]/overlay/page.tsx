import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Overlay from "@/er/components/Overlay";
import { currentUser } from "@/er/server/auth";
import { openView } from "@/er/server/http";
import { groupIndex } from "@/er/lib/view";

export const metadata: Metadata = { title: "방송 화면", robots: { index: false } };
export const dynamic = "force-dynamic";

const transparent = <style>{"html,body{background:transparent!important}"}</style>;

export default async function Page({ params, searchParams }: { params: Promise<{ code: string; group: string }>; searchParams: Promise<{ top?: string; scale?: string; side?: string }> }) {
  const { code, group } = await params;
  const q = await searchParams;
  const { limited, view } = await openView(code, await currentUser(), group, "page");
  // 방송 화면은 막혀도 없는 페이지를 띄우지 않고 빈 화면으로 두었다가 1분 뒤 다시 불러옴
  if (limited) {
    return (
      <>
        {transparent}
        <meta httpEquiv="refresh" content="60" />
      </>
    );
  }
  if (!view) notFound();
  const idx = groupIndex(view, group);
  if (idx < 0) notFound();
  return (
    <>
      {transparent}
      <Overlay
        initial={view}
        groupIdx={idx}
        limit={Math.max(1, Math.min(24, Number(q.top) || 24))}
        scale={Math.max(0.5, Math.min(3, Number(q.scale) || 1))}
        side={q.side === "left" ? "left" : "right"}
      />
    </>
  );
}
