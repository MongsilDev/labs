import type { Metadata } from "next";
import RankOverlay from "@/er/components/RankOverlay";

export const metadata: Metadata = { title: "티어 방송 화면", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ n?: string; scale?: string }> }) {
  const q = await searchParams;
  return (
    <>
      <style>{"html,body{background:transparent!important}"}</style>
      <RankOverlay nickname={(q.n ?? "").trim().slice(0, 32)} scale={Math.max(0.5, Math.min(3, Number(q.scale) || 1))} />
    </>
  );
}
