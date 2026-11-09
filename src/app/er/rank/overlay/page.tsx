import type { Metadata } from "next";
import RankOverlay from "@/er/components/RankOverlay";
import { overlayPlace } from "@/er/lib/rank";

export const metadata: Metadata = { title: "티어 방송 화면", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ n?: string; p?: string; x?: string; y?: string }> }) {
  const q = await searchParams;
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <RankOverlay nickname={(q.n ?? "").trim().slice(0, 32)} place={overlayPlace(q.p, q.x, q.y)} />
    </>
  );
}
