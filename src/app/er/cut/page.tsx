import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import CutChart from "@/er/components/cut/CutChart";
import DecayCalendar from "@/er/components/cut/DecayCalendar";
import RpCheck from "@/er/components/cut/RpCheck";
import Header from "@/er/components/Header";
import { type CutTier, daysLeft, int, TIERS, tens } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { currentUser } from "@/er/server/auth";
import { getCut } from "@/er/server/cut";

export const metadata: Metadata = {
  title: "이터컷 예측",
  description: "아시아1 이터니티와 데미갓 컷을 휴면 강등까지 반영해 계산하고 시즌 종료 컷을 예상합니다.",
};
export const dynamic = "force-dynamic";

function TierCard({ name, color, tier }: { name: string; color: string; tier: CutTier }) {
  const end = tier.forecast?.[tier.forecast.length - 1];
  return (
    <section className="panel p-5" aria-label={`${name} 컷`}>
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-fg-2">
        <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        {name} {int(tier.place)}위
      </h2>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-[40px] leading-none font-extrabold tracking-[-1px] tabular-nums">
          {tier.estimated && <span className="mr-1 text-[22px] text-fg-3">약</span>}
          {tier.cut != null ? int(tier.cut) : "-"}
        </span>
        <span className="text-[14px] font-semibold text-fg-3">RP</span>
      </p>
      <p className="mt-1.5 text-[13px] text-fg-3 tabular-nums">
        순위표 {tier.board != null ? int(tier.board) : "-"}
        {tier.dropped ? ` | 휴면 강등으로 내려갈 ${int(tier.dropped)}명 제외` : ""}
      </p>
      {end && (
        <dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 border-t border-line-soft pt-3">
          <div className="flex items-baseline gap-2">
            <dt className="text-[13px] text-fg-3">종료 예상</dt>
            <dd className="text-[22px] font-extrabold tabular-nums" style={{ color }}>
              {tens(end[1])}
            </dd>
          </div>
          <div className="flex items-baseline gap-2">
            <dt className="text-[13px] text-fg-3">범위</dt>
            <dd className="text-[15px] font-bold tabular-nums text-fg-2">
              {tens(end[2])}~{tens(end[3])}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5 max-[760px]:p-4" aria-labelledby={id}>
      <h2 className="mb-4 text-[17px] font-extrabold" id={id}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** ?rp= 값. 진단 칸 입력 규칙과 같은 0~20000 정수만 */
function rpParam(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d{1,5}$/.test(s) && Number(s) <= 20000 ? Number(s) : undefined;
}

export default async function CutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [user, data, query] = await Promise.all([currentUser(), getCut(), searchParams]);
  const left = data?.season.end ? daysLeft(data.season.end * 1000, data.updatedAt * 1000) : null;
  return (
    <>
      <Header user={user} crumb="이터컷 예측" crumbHref="/er/cut" />
      <main id="main" className="wrap cut">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 pb-5">
          <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">이터컷 예측</h1>
          {data && (
            <p className="text-[14px] text-fg-3">
              {data.season.name} | 아시아1{left != null ? ` | 종료 D-${left}` : ""} | {timeKo(data.updatedAt * 1000)} 기준
            </p>
          )}
        </div>
        {!data ? (
          <p className="panel px-5 py-4" role="status">
            지금은 컷 정보를 가져올 수 없습니다.
            <br />
            잠시 뒤 다시 열어주세요.
          </p>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
            <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
              {TIERS.map(({ key, name, color }) => (
                <TierCard key={key} name={name} color={color} tier={data.tiers[key]} />
              ))}
            </div>
            <Section id="chart-h" title="컷 추이와 종료 예상">
              <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-fg-3">
                {TIERS.map(({ key, name, color }) => (
                  <span key={key} className="flex items-center gap-1.5">
                    <span className="h-[3px] w-4 rounded-full" style={{ background: color }} aria-hidden="true" />
                    {name}
                  </span>
                ))}
                <span>굵은 선 휴면 반영 컷</span>
                <span>흐린 선 순위표 컷</span>
                <span>점선과 띠 종료 예상</span>
              </div>
              <CutChart data={data} />
            </Section>
            <Section id="check-h" title="내 RP 진단">
              <RpCheck data={data} initial={rpParam(query.rp)} />
            </Section>
            <Section id="decay-h" title="휴면 강등 일정">
              <DecayCalendar data={data} />
            </Section>
            <Section id="method-h" title="계산 방법">
              <ul className="grid gap-2 text-[14px] text-fg-2">
                <li>
                  휴면 반영 컷은 {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정의 RP에서 시즌 종료까지 깎일 RP를 빼고 다시 정렬한 순위표에서 이터니티 {int(data.tiers.eternity.place)}위와{" "}
                  데미갓 {int(data.tiers.demigod.place)}위의 RP입니다.
                  <br />
                  RP가 깎이는 규칙은 오래 쉬었다 돌아온 계정 341명의 RP 변화에 맞춰 정했고, 이 중 287명의 실제 변화와 일치합니다.
                </li>
                <li>
                  종료 예상은 매일 오전 9시 컷이 오르는 추세에, 지난 두 시즌 마지막 14일 동안 컷이 급등한 폭을 더한 값입니다.
                  <br />
                  이번 시즌 기록으로 검증한 결과, 7일 뒤 예상에는 평균 6점의 오차가 있었고 24일 뒤 예상에는 45~70점의 오차가 있었습니다.
                  <br />
                  범위는 그 오차의 80% 구간입니다.
                </li>
                <li>
                  순위표는 1,000위까지만 있으므로, 데미갓 컷은 휴면 계정이 내려간 자리를 채울 1,000위 밖 계정을 추정해 구합니다.
                </li>
                <li>
                  컷은 몽실봇이 매시 기록하는 아시아1 상위 1,000명 순위표로 계산합니다.
                  <br />
                  디스코드 <a href="https://bot.mongsil.dev">몽실봇</a>의 /이터컷 명령도 같은 값을 보여 줍니다.
                </li>
              </ul>
            </Section>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
