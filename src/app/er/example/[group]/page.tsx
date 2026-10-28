import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import TournamentApp from "@/er/components/t/TournamentApp";
import { exampleView } from "@/er/lib/example";
import { currentUser } from "@/er/server/auth";

export const metadata: Metadata = {
  title: exampleView().name,
  description: "2026 KEL 서킷 4 결승 실제 경기 기록으로 만든 점수 계산 예시입니다.",
};

export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const view = exampleView();
  const idx = group.toLowerCase().charCodeAt(0) - 97;
  if (group.length !== 1 || idx < 0 || idx >= view.groupCount) redirect("/er/example/a");
  const user = await currentUser();
  return (
    <>
      <Header user={user} crumb="점수 계산" />
      <TournamentApp initial={view} groupIdx={idx} basePath="/er/example" />
      <Footer wide />
    </>
  );
}
