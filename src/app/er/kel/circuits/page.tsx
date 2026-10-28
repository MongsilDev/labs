import { Fragment } from "react";
import BumpChart from "@/er/components/kel/BumpChart";
import KelPage, { KelScroll } from "@/er/components/kel/KelPage";
import { TeamName } from "@/er/components/kel/Team";
import { KEL_EVENTS, QUALIFY, SEEDS, seasonStandings } from "@/er/lib/kel";
import { kelGate, kelMetadata } from "@/er/server/kel";
import { top } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("circuits");

const CIRCUITS = KEL_EVENTS.filter((e) => /^c\d$/.test(e.key)).map((e) => e.name);
const CUTS: Record<number, string> = { [SEEDS]: "여기까지 결승 직행", [QUALIFY]: "여기까지 준결승" };

export default async function Page() {
  const { user, owner } = await kelGate("circuits");
  const season = seasonStandings();
  const riser = top(season, (r) => r.ranks[0] - r.rank).team;

  return (
    <KelPage user={user} owner={owner} screen="circuits" lead="서킷마다 받은 순위와 서킷 포인트 합계입니다.">
      <section className="panel p-5 max-[760px]:p-4">
        <KelScroll label="서킷별 최종 순위">
          <table className="kel-table">
            <thead>
              <tr>
                <th rowSpan={2} className="l w-10">
                  <span className="sr-only">시즌 순위</span>
                </th>
                <th rowSpan={2} className="l min-[761px]:w-[240px]">
                  팀
                </th>
                <th colSpan={CIRCUITS.length} className="text-center">
                  서킷
                </th>
                <th rowSpan={2} className="min-[761px]:w-[16%]">
                  <span className="wide">서킷 포인트 합계</span>
                  <span className="narrow">포인트</span>
                </th>
              </tr>
              <tr>
                {CIRCUITS.map((c, i) => (
                  <th key={c} aria-label={c} className="min-[761px]:w-[16%]">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {season.map((r) => (
                <Fragment key={r.team.key}>
                <tr className={CUTS[r.rank] ? "[&>td]:border-b-0" : undefined}>
                  <td className="l">
                    <span className={r.rank <= SEEDS ? "rk adv" : "rk"}>{r.rank}</span>
                  </td>
                  <td className="l max-w-[200px]">
                    <TeamName team={r.team} />
                  </td>
                  {r.team.circuits.map((c, i) => (
                    <td key={i} className={c === 1 ? "font-bold" : undefined}>
                      {c}
                      <span className="wide">위</span>
                    </td>
                  ))}
                  <td className="font-semibold">{r.total.toLocaleString("ko-KR")}</td>
                </tr>
                {CUTS[r.rank] && (
                  <tr aria-hidden="true">
                    <td colSpan={CIRCUITS.length + 3} className="border-t border-dashed border-t-line-strong py-0.5 text-right text-[12px] text-fg-3">
                      {CUTS[r.rank]}
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
      <section className="panel p-5 max-[760px]:p-4" aria-label="누적 순위 변화">
        <p className="mb-3 text-[13px] text-fg-3">
          서킷이 끝날 때마다 그때까지 받은 서킷 포인트 합계로 매긴 순위입니다.
          <br />
          서킷 1 뒤부터 순위가 가장 많이 오른 {riser.name}의 선을 강조했습니다.
        </p>
        <BumpChart rows={season.map((r) => ({ key: r.team.key, ranks: r.ranks }))} labels={CIRCUITS} initial={[riser.key]} legend="정규 시즌 순위" suffix="까지" />
      </section>
    </KelPage>
  );
}
