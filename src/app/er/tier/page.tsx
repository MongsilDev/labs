import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import { allViews, pickView } from "@/er/lib/tier";
import { currentUser } from "@/er/server/auth";
import { getTier } from "@/er/server/tier";
import TierBoard from "./TierBoard";

export const metadata: Metadata = {
  title: "실험체 티어",
};

export default async function TierPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, data, query] = await Promise.all([currentUser(), getTier(), searchParams]);
  const one = (k: string) => (Array.isArray(query[k]) ? query[k][0] : query[k]);
  const v = one("v");
  // 지난 시즌 탭은 뒤에 붙이고 기본값은 늘 지금 시즌
  const views = data ? allViews(data) : [];
  const fallback = data ? pickView(data) : null;
  const view = views.find((x) => x.id === v) ?? fallback;
  const cur = data?.views.find((x) => x.id === `patch-${data.patch}`);
  const early = data?.state === "collecting" && cur && !cur.ready ? { label: cur.label, patch: cur.patch, rows: cur.rows } : undefined;
  return (
    <>
      <Header user={user} crumb="실험체 티어" crumbHref="/er/tier" />
      <main id="main" className="wrap grid grid-cols-[minmax(0,1fr)] gap-4 pb-10">
        {!data || !view || !fallback ? (
          <>
            <h1 className="pt-3 text-[28px] font-extrabold tracking-[-0.5px]">실험체 티어</h1>
            <p className="panel px-5 py-4" role="status">
              지금은 티어 정보를 가져올 수 없습니다.
              <br />
              잠시 뒤 다시 열어주세요.
            </p>
          </>
        ) : (
          <>
            {data.state === "offseason" && (
              <p className="pt-3 text-[14px] text-fg-2" role="status">
                {data.next ? `${data.next} 상위 1,000명 기록이 아직 없어 ` : "시즌이 끝나 "}
                {data.season.name}의 마지막 표를 보여 줍니다.
              </p>
            )}
            <TierBoard
              views={views}
              initial={view.id}
              initialRole={one("r") ?? null}
              initialSort={one("s") === "pick" ? "pick" : "score"}
              initialQuery={one("q") ?? ""}
              fallback={fallback.id}
              updatedAt={data.updatedAt}
              seasonEnd={data.season.end}
              patch={data.patch}
              server={data.band.server}
              thin={data.rule.thin}
              few={data.rule.few}
              publishRows={data.rule.publishRows}
              early={early}
              weights={data.rule.weights}
            />
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
