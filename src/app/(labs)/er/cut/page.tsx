import type { Metadata } from "next";
import CutChart from "@/er/components/cut/CutChart";
import CutTable, { MyRp } from "@/er/components/cut/CutTable";
import DecayCalendar from "@/er/components/cut/DecayCalendar";
import { RaceLive, RaceTable, RaceTime } from "@/er/components/cut/RaceLive";
import { daysLeft, GATE, int, TIERS } from "@/er/lib/cut";
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
  const tiers = TIERS.map(({ key }) => data.tiers[key]);
  const above = tiers.some((t) => t.cut != null && t.cut > GATE);
  const forecast = tiers.some((t) => t.forecast?.length);
  const decay = tiers.some((t) => t.decay.some(([, n]) => n > 0));
  // 컷이 줄곧 같은 값이면 그래프에 그릴 것이 없음
  const flat = new Set(tiers.flatMap((t) => [t.cut, t.board, ...t.history.flatMap(([, b, a]) => [b, a])]).filter((v) => v != null)).size <= 1;
  const chart = forecast || (!flat && tiers.some((t) => t.history.length >= 1));
  // 흐린 선은 휴면 반영 전 순위표 컷. 굵은 선과 겹치지 않는 구간이 있을 때만 범례에 적음
  const faint = tiers.some((t) => t.history.some(([, b, a]) => a == null || a !== b) || (t.board != null && t.board !== t.cut));
  const side = race ? race.list.length > 0 : chart || decay;
  const body = (
    <MyRp initial={rpParam(query.rp)}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-bold tracking-[-0.5px]">이터컷 예측</h1>
        <p className="text-[13px] text-ink-3 num">
          {data.season.name}, 아시아1{left != null ? `, 종료 D-${left}` : ""}, {race ? <RaceTime /> : timeKo(data.updatedAt * 1000)} 기준
        </p>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-8 lg:grid-cols-12">
        <div className={`min-w-0 ${side ? "lg:col-span-5" : "max-w-[560px] lg:col-span-12"}`}>
          <CutTable data={data} live={!!race} />
        </div>
        {side && (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-8 lg:col-span-7">
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
                    {faint && <span>흐린 선 순위표 컷</span>}
                  </p>
                  {/* CutChart는 폭을 잰 뒤 높이를 300 또는 360으로 정해서 그 높이를 미리 잡아 둠 */}
                  <div className="mt-3 min-h-[300px] sm:min-h-[360px]">
                    <CutChart data={data} />
                  </div>
                </section>
              )
            )}
            {decay && (
              <section className="sec" aria-labelledby="decay-h">
                <h2 className="sec-h mb-2" id="decay-h">휴면 강등 일정</h2>
                <DecayCalendar data={data} />
              </section>
            )}
          </div>
        )}
      </div>

      <details className="sec mt-10 text-[13px] leading-relaxed text-ink-2">
        <summary className="w-fit cursor-pointer text-[14px] font-semibold text-ink-3">계산 방법</summary>
        <ul className="mt-3 grid max-w-[70ch] gap-3 text-pretty">
          {tiers.some((t) => t.cut == null || t.cut <= GATE) && (
            <li>
              {int(GATE)} RP 이상인 계정이 {int(data.tiers.eternity.place)}명이 되기 전에는 이터니티 컷이, {int(data.tiers.demigod.place)}명이 되기 전에는 데미갓 컷이 {int(GATE)}입니다.
            </li>
          )}
          {above && (
            <li>
              지금 컷은 {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정이 시즌 종료까지 잃을 RP를 빼고 다시 매긴 순위에서, 이터니티&nbsp;{int(data.tiers.eternity.place)}위와 데미갓&nbsp;{int(data.tiers.demigod.place)}위의 RP입니다.
            </li>
          )}
          {forecast && (
            <li>
              종료 예상은 지금 추세대로 오를 컷에, 지난 두 시즌 마지막 14일 동안 컷이 추세보다 더 오른 폭을 더한 값입니다.
              <br />
              그 아래 범위는 이번 시즌 기록으로 검증했을 때 실제 컷이 10번 가운데 8번 들어온 구간입니다.
            </li>
          )}
          {data.tiers.demigod.estimated && data.tiers.demigod.cut != null && data.tiers.demigod.cut > GATE && (
            <li>순위표는 1,000위까지만 있어서, 휴면 계정이 빠진 데미갓 자리는 1,000위 밖 계정을 추정해 채웁니다.</li>
          )}
        </ul>
      </details>
    </MyRp>
  );
  return <Live user={user}>{race ? <RaceLive initial={race}>{body}</RaceLive> : body}</Live>;
}
