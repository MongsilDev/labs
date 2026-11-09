import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import { allViews, comboSlug, pickView, type TierCombo, type TierView } from "@/er/lib/tier";
import { currentUser } from "@/er/server/auth";
import { getTier } from "@/er/server/tier";
import TierDetail from "../TierDetail";
import "../detail.css";

type Props = { params: Promise<{ combo: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

/** 어느 탭에든 있는 조합. 고른 탭에 없을 때도 이름과 그림은 보여 줌 */
function identity(views: TierView[], slug: string): TierCombo | undefined {
  for (const v of views) {
    const c = v.combos.find((x) => comboSlug(x) === slug);
    if (c) return c;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ combo }, data] = await Promise.all([params, getTier()]);
  const c = data ? identity(allViews(data), combo) : undefined;
  return { title: c ? `${c.weaponName} ${c.name}` : "실험체 티어" };
}

export default async function TierComboPage({ params, searchParams }: Props) {
  const [user, data, { combo }, query] = await Promise.all([currentUser(), getTier(), params, searchParams]);
  const v = Array.isArray(query.v) ? query.v[0] : query.v;
  const views = data ? allViews(data) : [];
  const fallback = data ? pickView(data) : null;
  const view = views.find((x) => x.id === v) ?? fallback;
  const who = identity(views, combo);
  if (data && !who) notFound();
  return (
    <>
      <Header user={user} crumb="실험체 티어" crumbHref={view && fallback && view.id !== fallback.id ? `/er/tier?v=${encodeURIComponent(view.id)}` : "/er/tier"} />
      <main id="main" className="wrap tdx">
        {!data || !view || !fallback || !who ? (
          <p className="panel px-5 py-4" role="status">
            지금은 티어 정보를 가져올 수 없습니다.
            <br />
            잠시 뒤 다시 열어주세요.
          </p>
        ) : (
          <TierDetail
            who={who}
            c={view.combos.find((x) => comboSlug(x) === combo)}
            view={view}
            views={views}
            fallback={fallback.id}
            routes={data.routes}
            items={data.items}
            thin={data.rule.thin}
            few={data.rule.few}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
