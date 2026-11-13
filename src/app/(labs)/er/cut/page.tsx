import type { Metadata } from "next";
import CutChart from "@/er/components/cut/CutChart";
import DecayCalendar from "@/er/components/cut/DecayCalendar";
import RpCheck from "@/er/components/cut/RpCheck";
import { daysLeft, int, TIERS, tens } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { avatarUrl, currentUser } from "@/er/server/auth";
import { getCut } from "@/er/server/cut";
import Live from "@/next/Live";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "이터컷 예측",
  description: "아시아1 이터니티와 데미갓 컷을 휴면 강등까지 반영해 계산하고 시즌 종료 컷을 예상합니다.",
};

/** ?rp= 값. 진단 칸 입력 규칙과 같은 0~20000 정수만 */
function rpParam(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d{1,5}$/.test(s) && Number(s) <= 20000 ? Number(s) : undefined;
}

export default async function CutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [me, data, query] = await Promise.all([currentUser(), getCut(), searchParams]);
  const user = me ? { name: me.name, avatar: avatarUrl(me) } : null;
  if (!data)
    return (
      <Live user={user}>
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.5px]">이터컷 예측</h1>
        <p className="mt-3 text-ink-3" role="status">
          지금은 컷 정보를 가져올 수 없습니다.
          <br />
          잠시 뒤 다시 열어주세요.
        </p>
      </Live>
    );
  const left = data.season.end ? daysLeft(data.season.end * 1000, data.updatedAt * 1000) : null;
  return (
    <Live user={user}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.5px]">이터컷 예측</h1>
        <p className="text-[13px] text-ink-3 num">
          {data.season.name}, 아시아1{left != null ? `, 종료 D-${left}` : ""}, {timeKo(data.updatedAt * 1000)} 기준
        </p>
      </div>

      <dl className="mt-4 grid border-t-2 border-ink lg:grid-cols-2">
        {TIERS.map(({ key, name, color }, i) => {
          const t = data.tiers[key];
          const end = t.forecast?.[t.forecast.length - 1];
          return (
            <div key={key} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 py-4 sm:grid-cols-3 sm:gap-4 ${i ? "border-t border-rule lg:border-t-0 lg:border-l lg:pl-6" : "lg:pr-6"}`}>
              <div className="max-sm:row-span-2">
                <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
                  <span className="h-3 w-1" style={{ background: color }} aria-hidden="true" />
                  {name} {int(t.place)}위
                </dt>
                <dd className="m-0 mt-1 text-[26px] leading-none font-bold tracking-[-1px] whitespace-nowrap num sm:text-[34px]">
                  {t.estimated && <span className="mr-0.5 text-[13px] font-bold text-ink-3 sm:text-[16px]">약</span>}
                  {t.cut != null ? int(t.cut) : "-"}
                </dd>
                {t.board != null && t.cut != null && int(t.board) !== int(t.cut) && <dd className="m-0 mt-1.5 text-[12px] text-ink-3 num">순위표 {int(t.board)}</dd>}
              </div>
              {end && (
                <>
                  <div>
                    <dt className="text-[12px] font-semibold text-ink-3">종료 예상</dt>
                    <dd className="m-0 mt-2.5 text-[20px] leading-none font-bold num">{tens(end[1])}</dd>
                  </div>
                  <div className="max-sm:col-start-2">
                    <dt className="text-[12px] font-semibold text-ink-3 max-sm:sr-only">범위</dt>
                    <dd className="m-0 mt-1.5 text-[12px] leading-none text-ink-3 num sm:mt-2.5 sm:text-[20px] sm:font-bold sm:text-ink-2">{tens(end[2])}~{tens(end[3])}</dd>
                  </div>
                </>
              )}
              {t.dropped ? <p className="col-span-full text-[12px] text-ink-3 num max-sm:mt-3">휴면 강등으로 내려갈 {int(t.dropped)}명을 뺀 값입니다.</p> : null}
            </div>
          );
        })}
      </dl>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-flow-row-dense lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
        {/* 새 시즌 첫날처럼 기록이 이틀이 안 되면 선이 없어 칸을 뺌 */}
        {TIERS.some(({ key }) => data.tiers[key].history.length >= 2 || data.tiers[key].forecast?.length) && (
        <section className="sec min-w-0 self-start lg:col-span-8" aria-labelledby="chart-h">
          <h2 className="sec-h" id="chart-h">컷 추이</h2>
          <p className="mt-1 flex flex-wrap gap-x-4 text-[12px] text-ink-3">
            {TIERS.map(({ key, name, color }) => (
              <span key={key} className="flex items-center gap-1.5 text-ink-2">
                <span className="h-[2px] w-4" style={{ background: color }} aria-hidden="true" />
                {name}
              </span>
            ))}
            <span>굵은 선 휴면 반영 컷</span>
            <span>흐린 선 순위표 컷</span>
            {TIERS.some(({ key }) => data.tiers[key].forecast?.length) && <span>점선과 음영 종료 예상</span>}
          </p>
          {/* CutChart는 폭을 잰 뒤 높이를 300 또는 360으로 정해서 그 높이를 미리 잡아 둠 */}
          <div className="mt-3 min-h-[300px] sm:min-h-[360px]">
            <CutChart data={data} />
          </div>
        </section>
        )}
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-10 lg:col-span-4 lg:col-start-9 lg:row-span-2">
          <section className="sec" aria-labelledby="check-h">
            <h2 className="sec-h mb-3" id="check-h">내 RP 진단</h2>
            <div className="rpcheck"><RpCheck data={data} initial={rpParam(query.rp)} /></div>
          </section>
          <section className="sec" aria-labelledby="decay-h">
            <h2 className="sec-h mb-3" id="decay-h">휴면 강등 일정</h2>
            <DecayCalendar data={data} />
          </section>
        </div>
        <section className="sec min-w-0 self-start lg:col-span-8" aria-labelledby="method-h">
          <h2 className="sec-h" id="method-h">계산 방법</h2>
          <ul className="mt-2 grid gap-3 text-[13px] leading-relaxed text-ink-2">
            <li>
              휴면 반영 컷은 {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정의 RP에서 시즌 종료까지 깎일 RP를 빼고 다시 정렬한 순위표에서 이터니티 {int(data.tiers.eternity.place)}위와 데미갓 {int(data.tiers.demigod.place)}위의 RP입니다.
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
            <li>순위표는 1,000위까지만 있으므로, 데미갓 컷은 휴면 계정이 내려간 자리를 채울 1,000위 밖 계정을 추정해 구합니다.</li>
            <li>
              컷은 몽실봇이 매시 기록하는 아시아1 상위 1,000명 순위표로 계산합니다.
              <br />
              디스코드 <a className="underline" href="https://bot.mongsil.dev">몽실봇</a>의 /이터컷 명령도 같은 값을 보여 줍니다.
            </li>
          </ul>
        </section>
      </div>
    </Live>
  );
}
