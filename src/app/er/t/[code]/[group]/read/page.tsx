import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import LiveRead from "@/er/components/LiveRead";
import Limited from "@/er/components/t/Limited";
import { currentUser } from "@/er/server/auth";
import { openView } from "@/er/server/http";
import { groupIndex } from "@/er/lib/view";

export const metadata: Metadata = { title: "경기 중 점수 읽기", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ code: string; group: string }> }) {
  const { code, group } = await params;
  const user = await currentUser();
  if (!user) redirect(`/auth/login?next=${encodeURIComponent(`/er/t/${code.toUpperCase()}/${group}/read`)}`);
  const { limited, view } = await openView(code, user, group, "page");
  if (limited) return <Limited />;
  if (!view?.role) notFound();
  const idx = groupIndex(view, group);
  if (idx < 0) notFound();
  return (
    <>
      <Header user={user} crumb="대회 점수" />
      <LiveRead initial={view} groupIdx={idx} segment={group} />
      <Footer />
    </>
  );
}
