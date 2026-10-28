import type { Metadata } from "next";
import CreateForm from "@/er/components/CreateForm";
import ExampleBoard from "@/er/components/ExampleBoard";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import OpenCode from "@/er/components/OpenCode";
import { currentUser } from "@/er/server/auth";
import { myTournaments } from "@/er/server/tournament";
import Lines from "@/components/Lines";

export const metadata: Metadata = {
  title: "점수 계산",
  description: "이터널 리턴 커스텀 게임 결과 CSV로 커뮤니티 대회 순위, 감점, 체크포인트, 금지 실험체를 계산합니다.",
};
export const dynamic = "force-dynamic";

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ create?: string; login?: string }> }) {
  const q = await searchParams;
  const user = await currentUser();
  const mine = user ? myTournaments(user) : [];
  return (
    <>
      <Header user={user} crumb="점수 계산" />
      <main id="main" className="wrap">
        {q.login === "failed" && (
          <p className="panel mb-4 border-minus px-4 py-3" role="alert">
            <Lines text="디스코드 로그인을 마치지 못했습니다. 다시 시도해주세요." />
          </p>
        )}
        <div className="grid grid-cols-[minmax(0,460px)_minmax(0,1fr)] items-start gap-10 max-[900px]:grid-cols-[minmax(0,1fr)] max-[900px]:gap-6">
          <section aria-labelledby="new-h">
            <h1 className="mt-3 mb-[18px] text-[28px] font-extrabold tracking-[-0.5px]" id="new-h">
              새 대회
            </h1>
            <CreateForm loggedIn={Boolean(user)} autoCreate={q.create === "1"} />
          </section>
          <div className="mt-[72px] grid grid-cols-[minmax(0,1fr)] gap-4 max-[900px]:contents">
            <OpenCode mine={mine} />
            <ExampleBoard />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
