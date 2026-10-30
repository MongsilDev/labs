import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import Limited from "@/er/components/t/Limited";
import TournamentApp from "@/er/components/t/TournamentApp";
import { currentUser } from "@/er/server/auth";
import { openView } from "@/er/server/http";
import { summary } from "@/er/server/og";
import { groupIndex } from "@/er/lib/view";

type P = { params: Promise<{ code: string; group: string }>; searchParams?: Promise<{ created?: string }> };

export const dynamic = "force-dynamic";

// 제목과 본문이 한 요청에서 같은 판정을 쓰게 해서, 막힌 IP에는 있는 코드와 없는 코드의 제목이 같음
const guarded = cache(async (code: string, group: string) => {
  const user = await currentUser();
  return { ...(await openView(code, user, group, "page")), user };
});

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { code, group } = await params;
  // 소문자 코드는 본문이 대문자 주소로 보내므로 여기서 요청 한도와 없는 코드 횟수를 쓰지 않음
  if (code !== code.toUpperCase()) return { robots: { index: false } };
  const { limited, view } = await guarded(code, group);
  if (limited) return { title: "대회", robots: { index: false } };
  if (!view) return { title: "없는 대회", robots: { index: false } };
  const description = summary(view, Math.max(0, groupIndex(view, group)));
  return { title: view.name, description, openGraph: { title: view.name, description, siteName: "Labs", type: "website", locale: "ko_KR" }, robots: { index: false } };
}

export default async function Page({ params, searchParams }: P) {
  const { code, group } = await params;
  const q = (await searchParams) ?? {};
  const upper = code.toUpperCase();
  if (upper !== code) redirect(`/er/t/${upper}/${group.toLowerCase()}`);
  const { limited, view, user } = await guarded(code, group);
  if (limited) return <Limited />;
  if (!view) notFound();
  const idx = groupIndex(view, group);
  if (idx < 0) redirect(`/er/t/${view.code}/a`);
  return (
    <>
      <Header user={user} crumb="점수 계산" />
      <TournamentApp initial={view} groupIdx={idx} basePath={`/er/t/${view.code}`} created={q.created === "1"} />
      <Footer wide />
    </>
  );
}
