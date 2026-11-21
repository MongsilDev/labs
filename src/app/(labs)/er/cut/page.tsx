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
          const head = t.cut == null || t.cut <= GATE ? floorHead(data.rps, t.place) : null;
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
        <ul className="mt-3 grid max-w-[70ch] gap-3 text-pretty">
            <li>
              휴면 반영 컷은 {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정이 시즌 종료까지 잃을 RP를 빼고 다시 매긴 순위에서, 이터니티&nbsp;{int(data.tiers.eternity.place)}위와 데미갓&nbsp;{int(data.tiers.demigod.place)}위의 RP입니다.
            </li>
            <li>
              종료 예상은 지금 추세대로 오를 컷에, 지난 두 시즌 마지막 14일 동안 컷이 추세보다 더 오른 폭 가운데 아직 남은 날의 몫을 더한 값입니다.
              <br />
              예상 범위는 이번 시즌 기록으로 검증했을 때 실제 컷이 10번 가운데 8번 들어온 구간입니다.
            </li>
            <li>순위표는 1,000위까지만 있어서, 휴면 계정이 빠진 데미갓 자리는 1,000위 밖 계정을 추정해 채웁니다.</li>
        </ul>
      </details>
    </>
  );
  return <Live user={user}>{race ? <RaceLive initial={race}>{body}</RaceLive> : body}</Live>;
}
