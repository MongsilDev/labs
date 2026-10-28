import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import InviteAccept from "@/er/components/InviteAccept";
import { MODE_LABEL } from "@/er/lib/rules";
import { currentUser } from "@/er/server/auth";
import { inviteInfo } from "@/er/server/tournament";
import Lines from "@/components/Lines";

export const metadata: Metadata = { title: "운영자 초대", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await currentUser();
  const info = inviteInfo(token);
  return (
    <>
      <Header user={user} />
      <main id="main" className="wrap slim">
        <section className="panel mx-auto my-10 grid max-w-[460px] gap-3 p-[26px]">
          {info ? (
            <>
              <p className="text-fg-3">{info.inviter}님의 초대</p>
              <h1 className="text-[21px] font-extrabold">{info.name} 운영자</h1>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 rounded-md border border-line-soft p-3.5 text-[14px] [&>dt]:text-fg-3">
                <dt>대회 코드</dt>
                <dd translate="no">{info.code}</dd>
                <dt>진행 방식</dt>
                <dd>
                  {MODE_LABEL[info.mode]} {info.mode === "points" ? `${info.plannedRounds}라운드` : `최대 ${info.plannedRounds}라운드`}
                  {info.groupCount > 1 ? `, ${info.groupCount}개 조` : ""}
                </dd>
                {info.usesLeft > 1 && (
                  <>
                    <dt>남은 자리</dt>
                    <dd>{info.usesLeft}명</dd>
                  </>
                )}
                <dt>할 수 있는 일</dt>
                <dd>CSV 추가, 감점, 날씨, 팀 이름 정리</dd>
              </dl>
              <InviteAccept token={token} loggedIn={Boolean(user)} />
            </>
          ) : (
            <>
              <h1 className="text-[21px] font-extrabold">쓸 수 없는 초대 링크입니다</h1>
              <p className="text-fg-3">
                <Lines text="인원이 다 찼거나 취소된 링크입니다. 개최자에게 새 링크를 요청해주세요." />
              </p>
            </>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}
