import type { Metadata } from "next";
import RankOverlay from "@/er/components/RankOverlay";
import { overlayPlace } from "@/er/lib/rank";

export const metadata: Metadata = { title: "랭크 오버레이", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ n?: string; p?: string; x?: string; y?: string; scale?: string }> }) {
  const q = await searchParams;
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <RankOverlay nickname={(q.n ?? "").trim().slice(0, 32)} place={overlayPlace(q.p, q.x, q.y, q.scale)} />
    </>
  );
}
