import type { Metadata } from "next";
import CutChart from "@/er/components/cut/CutChart";
import DecayCalendar from "@/er/components/cut/DecayCalendar";
import { RaceCount, RaceLive, RaceTable, RaceTime } from "@/er/components/cut/RaceLive";
import RpCheck from "@/er/components/cut/RpCheck";
import { type CutTier, DAY, daysLeft, floorHead, GATE, int, md, TIERS, tens } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { accountUser, currentUser } from "@/er/server/auth";
import { getCut } from "@/er/server/cut";
import { getRace } from "@/er/server/race";
import Live from "@/next/Live";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "이터컷 예측",
  description: "아시아1 이터니티와 데미갓 컷을 휴면 강등까지 반영해 계산하고 시즌 종료 컷을 예상합니다.",
};

const LATE_DAYS = 14;

/** 24시간 전에 가장 가까운 오전 9시 기록의 시각과, 지금 휴면 반영 컷과의 차이. 그 기록이 12시간보다 가까우면 null */
function dayDelta(t: CutTier, at: number): [number, number] | null {
  if (t.cut == null) return null;
  const past = t.history.filter(([s, , a]) => a != null && at - s >= DAY / 2000);
  if (!past.length) return null;
  const [s, , a] = past.reduce((p, q) => (Math.abs(at - DAY / 1000 - q[0]) < Math.abs(at - DAY / 1000 - p[0]) ? q : p));
  return [s, t.cut - (a as number)];
}

function Delta({ at, v }: { at: number; v: number }) {
  return <span>{md(at * 1000)} 9시보다 {v > 0 ? `▲${int(v)}` : v < 0 ? `▼${int(-v)}` : "변동 없음"}</span>;
}

/** ?rp= 값. 진단 칸 입력 규칙과 같은 0~20000 정수만 */
function rpParam(v: string | string[] | undefined): number | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d{1,5}$/.test(s) && Number(s) <= 20000 ? Number(s) : undefined;
}

export default async function CutPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [me, data, query] = await Promise.all([currentUser(), getCut(), searchParams]);
  const user = accountUser(me);
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
  const race = await getRace(data.season.id);
  const left = data.season.end ? daysLeft(data.season.end * 1000, data.updatedAt * 1000) : null;
  // 이터런이 열린 시즌 초, 종료 2주 전부터의 막바지, 그 사이 중반에 보여 줄 칸과 순서가 다름
  const late = !race && left != null && left <= LATE_DAYS;
  const decay = TIERS.some(({ key }) => data.tiers[key].decay.some(([, n]) => n > 0));
  const chart = TIERS.some(({ key }) => data.tiers[key].history.length >= 2 || data.tiers[key].forecast?.length);
  const decaySec = decay && (
    <section className="sec" aria-labelledby="decay-h">
      <h2 className="sec-h mb-3" id="decay-h">휴면 강등 일정</h2>
      <DecayCalendar data={data} />
    </section>
  );
  const body = (
    <>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.5px]">이터컷 예측</h1>
        <p className="text-[13px] text-ink-3 num">
          {data.season.name}, 아시아1{left != null ? `, 종료 D-${left}` : ""}, {race ? <RaceTime /> : timeKo(data.updatedAt * 1000)} 기준
        </p>
      </div>

      <dl className="mt-4 grid border-t-2 border-ink lg:grid-cols-2">
        {TIERS.map(({ key, name, color }, i) => {
          const t = data.tiers[key];
          const end = t.forecast?.[t.forecast.length - 1];
          const head = floorHead(data.rps, t.place);
          const day = dayDelta(t, data.updatedAt);
          return (
            <div key={key} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 py-4 ${i ? "border-t border-rule lg:border-t-0 lg:border-l lg:pl-6" : "lg:pr-6"}`}>
              <div>
                <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3">
                  <span className="h-3 w-1" style={{ background: color }} aria-hidden="true" />
                  {name} {head ? `${int(head.rank)}위 RP` : `${int(t.place)}위 컷`}
                </dt>
                <dd className="m-0 mt-1 text-[30px] leading-none font-bold tracking-[-1px] whitespace-nowrap num sm:text-[40px]">
                  {head ? int(head.rp) : t.cut != null ? int(t.cut) : "-"}
                </dd>
                <dd className="m-0 mt-2 flex flex-wrap gap-x-3 text-[12px] whitespace-nowrap text-ink-3 num">
                  {head ? (
                    <>
                      {head.rank < t.place && <span>{int(t.place)}위는 순위표 밖</span>}
                      <span>RP 하한 {int(GATE)}</span>
                    </>
                  ) : (
                    day && <Delta at={day[0]} v={day[1]} />
                  )}
                  {!head && t.board != null && t.cut != null && int(t.board) !== int(t.cut) && <span>순위표 {int(t.board)}</span>}
                  {!head && t.estimated && <span>추정치</span>}
                </dd>
              </div>
              {race ? (
                <div className="text-right">
                  <dt className="text-[12px] font-semibold text-ink-3">{int(GATE)} 달성</dt>
                  <dd className="m-0 mt-1.5 text-[20px] leading-none font-bold num sm:text-[24px]">
                    <RaceCount />
                    <span className="text-[13px] font-semibold text-ink-3">/{int(t.place)}명</span>
                  </dd>
                </div>
              ) : (
                end && (
                  <div className="text-right">
                    <dt className="text-[12px] font-semibold text-ink-3">종료 예상</dt>
                    <dd className="m-0 mt-1.5 text-[20px] leading-none font-bold num sm:text-[24px]">{tens(end[1])}</dd>
                    <dd className="m-0 mt-2 text-[12px] text-ink-3 num">{tens(end[2])}~{tens(end[3])}</dd>
                  </div>
                )
              )}
            </div>
          );
        })}
      </dl>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-10 lg:grid-cols-12">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-10 lg:col-span-8">
          {race ? (
            <RaceTable />
          ) : (
            chart && (
              <section className="sec min-w-0" aria-labelledby="chart-h">
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
            )
          )}
          {!late && decaySec}
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-10 lg:col-span-4">
          {late && decaySec}
          <section className="sec" aria-labelledby="check-h">
            <h2 className="sec-h mb-3" id="check-h">내 RP 진단</h2>
            <div className="rpcheck"><RpCheck data={data} initial={rpParam(query.rp)} floor={!!race} /></div>
          </section>
        </div>
      </div>

      <details className="sec mt-10 text-[13px] leading-relaxed text-ink-2">
        <summary className="w-fit cursor-pointer text-[14px] font-semibold text-ink-3">계산 방법</summary>
        <ul className="mt-3 grid max-w-[760px] gap-3">
            <li>
              휴면 반영 컷은 {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정의 RP에서 시즌 종료까지 깎일 RP를 빼고 다시 정렬한 순위표에서 이터니티 {int(data.tiers.eternity.place)}위와 데미갓 {int(data.tiers.demigod.place)}위의 RP입니다.
              <br />
              RP가 깎이는 규칙은 오래 쉬었다 돌아온 계정 341명의 RP 변화에 맞춰 정했습니다.
              <br />
              이 규칙은 341명 가운데 287명의 실제 변화와 일치합니다.
            </li>
            <li>
              종료 예상은 매일 오전 9시 컷이 오르는 추세에, 지난 두 시즌 마지막 14일 동안 컷이 급등한 폭을 더한 값입니다.
              <br />
              이번 시즌 기록으로 검증한 결과, 7일 뒤 예상에는 평균 6점의 오차가 있었고 24일 뒤 예상에는 45~70점의 오차가 있었습니다.
              <br />
              범위는 그 오차의 80% 구간입니다.
            </li>
            <li>
              {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정은 유예 기간이 지난 뒤 매일 15시에 RP가 {data.rule.step}점씩 깎입니다.
              <br />
              게임 기록은 매일 05시에 확인하므로, 05시 뒤에 한 게임은 그날 15시 차감을 막지 못합니다.
              <br />
              {data.updatedAt < data.rule.graceFrom
                ? `유예는 최대 ${data.rule.grace.default}일이고, 10월 29일 12.7 패치부터 이터니티 최대 ${data.rule.grace.eternity}일, 데미갓 최대 ${data.rule.grace.demigod}일로 줄어듭니다.`
                : `유예는 이터니티 최대 ${data.rule.grace.eternity}일, 데미갓 최대 ${data.rule.grace.demigod}일, 그 밖의 티어 최대 ${data.rule.grace.default}일입니다.`}
            </li>
            <li>순위표는 1,000위까지만 있으므로, 데미갓 컷은 휴면 계정이 내려간 자리를 채울 1,000위 밖 계정을 추정해 구합니다.</li>
            <li>
              {data.source === "global"
                ? "컷은 통합 순위표에서 아시아1 계정만 골라 매긴 순위로 계산합니다."
                : "컷은 몽실봇이 매시 기록하는 아시아1 상위 1,000명 순위표로 계산합니다."}
              <br />
              디스코드 <a className="underline" href="https://bot.mongsil.dev">몽실봇</a>의 /이터컷 명령도 같은 값을 보여 줍니다.
            </li>
        </ul>
      </details>
    </>
  );
  return <Live user={user}>{race ? <RaceLive initial={race}>{body}</RaceLive> : body}</Live>;
}
