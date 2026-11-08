import type { Metadata } from "next";
import { Fragment } from "react";
import Footer from "@/components/SiteFooter";
import Char from "@/er/components/t/Char";
import Header from "@/er/components/Header";
import { KelTabs } from "@/er/components/kel/KelPage";
import KelScroll from "@/er/components/kel/KelScroll";
import { int } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { pickView, signed, TIER_BOUNDS, type TierCombo, type TierData, type TierView } from "@/er/lib/tier";
import { currentUser } from "@/er/server/auth";
import { getTier } from "@/er/server/tier";

export const metadata: Metadata = {
  title: "실험체 티어",
  // 메뉴와 sitemap에 넣기 전까지는 검색에 노출하지 않음
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

function Row({ c, thin }: { c: TierCombo; thin: number }) {
  const few = c.n < thin;
  return (
    <tr className={few ? "tier-thin" : undefined}>
      <td className="l">
        <span className="tier-grade" data-grade={c.grade}>
          {c.grade}
        </span>
      </td>
      <td className="l">
        <Char name={c.key} label={c.name} />
        <span className="ml-1.5 text-fg-3">{c.weaponName}</span>
      </td>
      <td className="font-bold" title={`보정 전 ${signed(c.raw)}, ${int(c.n)}판`}>
        {signed(c.score)}
      </td>
      <td className="wide">{c.place.toFixed(2)}</td>
      <td>{c.top3.toFixed(1)}%</td>
      <td className="wide">{c.pick.toFixed(2)}%</td>
      <td className="text-fg-3">
        {int(c.n)}
        <span className="wide">판 {int(c.players)}명</span>
      </td>
    </tr>
  );
}

function Table({ view, thin }: { view: TierView; thin: number }) {
  return (
    <KelScroll label="실험체 티어" className="panel">
      <table className="kel-table tier-table w-full">
        <thead>
          <tr>
            <th className="l w-12">등급</th>
            <th className="l">실험체</th>
            <th>점수</th>
            <th className="wide">평균 순위</th>
            <th>TOP3</th>
            <th className="wide">픽률</th>
            <th>표본</th>
          </tr>
        </thead>
        <tbody>
          {view.combos.map((c) => (
            <Row key={`${c.char}:${c.weapon}`} c={c} thin={thin} />
          ))}
        </tbody>
      </table>
    </KelScroll>
  );
}

function Method({ data, view }: { data: TierData; view: TierView }) {
  const r = data.rule;
  return (
    <section className="panel p-5" aria-labelledby="method-h">
      <h2 className="mb-4 text-[17px] font-extrabold" id="method-h">
        계산 방법
      </h2>
      <ul className="grid gap-2 text-[14px] text-fg-2">
        <li>
          표본은 경기를 시작할 때 {data.band.server} 1,000위 안에 있던 플레이어의 랭크 게임입니다.
          <br />
          1,000위 RP로는 몽실봇이 매시 기록하는 순위표 가운데 경기 직전에 기록된 값을 씁니다. 그 값이 데미갓 최소 RP인 {int(data.band.floor)}보다 낮으면 {int(data.band.floor)}으로 간주합니다.
        </li>
        <li>
          점수는 한 판에서 입장료를 빼기 전에 얻은 RP가 표본 평균 {view.base.toFixed(1)}보다 얼마나 많은지를 나타냅니다.
          <br />
          판 수가 적은 실험체의 점수는 0에 가깝게, 판 수가 적은 조합의 점수는 그 실험체 점수에 가깝게 보정합니다. {int(view.k)}판인 조합은 보정 전 값과 실험체 점수의 차이가 절반으로 줄어듭니다.
          <br />
          한 사람의 판은 조합이나 실험체 전체 판 수의 {Math.round(r.cap * 100)}%까지만 셉니다.
        </li>
        <li>
          등급은 점수를 표준화한 값으로 나눕니다.{" "}
          {TIER_BOUNDS.map(([g, min]) => (
            <Fragment key={g}>
              <span className="whitespace-nowrap">
                {g}는 {min} 이상,
              </span>{" "}
            </Fragment>
          ))}
          <span className="whitespace-nowrap">나머지는 D입니다.</span>
        </li>
        <li>{r.thin}판 미만인 조합은 흐리게 표시합니다.</li>
      </ul>
    </section>
  );
}

export default async function TierPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, data, query] = await Promise.all([currentUser(), getTier(), searchParams]);
  const v = Array.isArray(query.v) ? query.v[0] : query.v;
  const view = data ? pickView(data, v) : null;
  const cur = data?.views.find((x) => x.id === `patch-${data.patch}`);
  const early = data?.state === "collecting" && cur && !cur.ready ? cur : undefined;
  return (
    <>
      <Header user={user} crumb="실험체 티어" crumbHref="/er/tier" />
      <main id="main" className="wrap">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 pb-5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">실험체 티어</h1>
          {data && view && (
            <p className="text-[14px] text-fg-3 tabular-nums">
              in1000 | {data.band.server} | {int(view.rows)}판 | {timeKo(data.updatedAt)} 기준
            </p>
          )}
        </div>
        {!data || !view ? (
          <p className="panel px-5 py-4" role="status">
            지금은 티어 정보를 가져올 수 없습니다.
            <br />
            잠시 뒤 다시 열어주세요.
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <KelTabs label="기간" items={data.views.map((x) => [x.id, x.label] as const)} current={view.id} href={(id) => `/er/tier?v=${id}`} />
            {early && (
              <p className="text-[14px] text-fg-2" role="status">
                {view.patch === early.patch
                  ? `${early.label} 표본이 ${int(data.rule.publishRows)}판보다 적어 등급이 크게 바뀔 수 있습니다. 지금 ${int(early.rows)}판입니다.`
                  : `${early.label} 표는 ${int(data.rule.publishRows)}판부터 기본으로 보여 줍니다. 지금 ${int(early.rows)}판입니다.`}
              </p>
            )}
            {data.state === "offseason" && (
              <p className="text-[14px] text-fg-2" role="status">
                시즌이 끝나 {data.season.name}의 마지막 표를 보여 줍니다.
              </p>
            )}
            <Table view={view} thin={data.rule.thin} />
            <Method data={data} view={view} />
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
