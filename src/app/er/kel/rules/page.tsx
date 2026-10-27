import { Fragment } from "react";
import Lines from "@/components/Lines";
import Checkpoints from "@/er/components/kel/Checkpoints";
import KelPage, { KelScroll } from "@/er/components/kel/KelPage";
import { TeamName } from "@/er/components/kel/Team";
import { rampColor } from "@/er/lib/format";
import { CIRCUIT_POINTS, KEL_EVENTS, QUALIFY, SEEDS, seasonStandings } from "@/er/lib/kel";
import { PLACEMENT_POINTS } from "@/er/lib/rules";
import { kelGate, kelMetadata } from "@/er/server/kel";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("rules");

const FLOW = [
  ...KEL_EVENTS.map((e) => ({ name: e.name, dates: e.dates, points: /^c\d$/.test(e.key) })),
  { name: "준결승", dates: "11.7", points: false },
  { name: "결승", dates: "11.8", points: false },
];

const PENALTIES: [string, string][] = [
  ["지각", "5점"],
  ["경기 시작 시간까지 게임 로비에 들어오지 않음", "3점"],
  ["실험체를 고르지 않아 로비로 돌아감", "5점"],
  ["교체 마감 뒤 선수 교체", "3점"],
  ["금지구역, 야생 동물처럼 처치한 선수가 없는 사망", "1점"],
  ["로비 입장이 10분 넘게 늦어짐", "그 라운드 몰수"],
];

const FAQ: { q: string; a?: string; extra?: React.ReactNode }[] = [
  {
    q: "서킷에서 우승하면 결승에 바로 진출하나요?",
    a: "아닙니다. 서킷 1~4에서 받은 서킷 포인트를 더한 순위로 1~4위가 결승에 바로 진출합니다. 5~12위는 11월 7일 준결승에 출전하고, 그중 상위 4팀이 결승에 진출합니다.",
  },
  {
    q: "순차 체크포인트는 무엇인가요?",
    a: "오프닝 위크와 서킷, 미드 시즌 컵, 챔피언십의 결승에서 쓰는 방식입니다. 4라운드까지는 각 팀이 점수만 누적하고, 5라운드부터는 직전 라운드까지 누적한 순위에서 상위 팀이 체크포인트를 받습니다. 체크포인트를 받은 팀이 그 라운드에서 마지막까지 살아남으면 우승합니다.",
    extra: <Checkpoints />,
  },
  { q: "점수가 가장 높은데 왜 우승이 아닌가요?", a: "체크포인트를 가진 팀이 라운드 1위를 차지하면 그 팀이 점수와 관계없이 우승합니다. 나머지 팀의 순위는 점수로 정합니다." },
  {
    q: "감점을 받으면 체크포인트가 없어지나요?",
    a: "라운드 사이에 받은 감점으로는 체크포인트가 없어지지 않습니다. 9월 7일 개정 공지에는 이 내용이 있지만, 10월 12일 시행판 규정집에는 없습니다. 게임 안에서 받은 감점은 그 라운드 점수에 반영되므로, 체크포인트를 받는 순위에도 영향을 줍니다.",
  },
  {
    q: "감점은 몇 점인가요?",
    extra: (
      <>
        <table className="kel-table mt-2">
          <tbody>
            {PENALTIES.map(([reason, points]) => (
              <tr key={reason}>
                <td className="l whitespace-normal">{reason}</td>
                <td className="font-bold">{points}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[14px] text-fg-2">금지구역이나 야생 동물 때문에 사망해도 마지막 2팀이 남았을 때는 감점하지 않습니다.</p>
      </>
    ),
  },
  {
    q: "포인트나 점수가 같으면 누가 위인가요?",
    a: "서킷 포인트 합계가 같으면 서킷 4 순위가 높은 팀이 정규 시즌 순위에서 앞섭니다. 한 경기 안에서 총점이 같으면 규정집에는 킬 수, 마지막 라운드 순위 순서로 정한다고 적혀 있지만, 공식 순위표는 킬 점수로 순위를 정했습니다. 서킷 1 결승에서는 82점으로 같았던 두 팀 가운데 킬 점수가 1점 많은 GC 부산 스텔라가 3위였고, 킬 수가 더 많았던 경남 스파클은 4위였습니다.",
  },
  {
    q: "킬 점수가 0.5점인 경우는 언제인가요?",
    a: "팀이 전멸해도 자동으로 부활할 수 있는 시간에 나온 킬은 0.5점입니다. 게임 안 1일차에 나온 킬과 2일차 전투 연구실에서 나온 킬을 0.5점으로 셉니다. 3일차부터 나온 킬은 1점입니다. 2일차에 전투 연구실 밖에서 나온 킬의 점수는 규정집에 적혀 있지 않습니다.",
  },
  {
    q: "2픽캡은 무엇인가요?",
    a: "한 팀이 같은 실험체를 매치마다 2번까지만 쓸 수 있는 규칙입니다. 규정집에는 하루에 2번까지라고 적혀 있지만, 경기 기록을 보면 같은 날 열린 패자조와 최종전에서는 실험체 사용 횟수를 경기마다 따로 계산했습니다. 결승도 서킷 2부터 2픽캡 규칙으로 진행했습니다.",
  },
  { q: "선수는 언제 바꿀 수 있나요?", a: "2라운드마다 바꿀 수 있습니다. 팀은 경기가 끝난 뒤 온라인은 5분, 오프라인은 2분 안에 교체 여부를 사무국이 정한 방법으로 전달해야 합니다. 마감 뒤에 바꾸면 3점을 감점합니다." },
];

const CUTS: Record<number, string> = { [SEEDS]: "여기까지 결승 직행", [QUALIFY]: "여기까지 준결승" };

const POINT_ROWS: [string, number[]][] = [
  ["서킷 1, 2", CIRCUIT_POINTS.early],
  ["서킷 3, 4", CIRCUIT_POINTS.late],
];

export default async function Page() {
  const { user, owner } = await kelGate("rules");
  const season = seasonStandings();
  const max = season[0].total;
  const ranks = ["1위", "2위", "3위", "4위", "5위", "6위", "7위", "8위", "9~12위", "13~16위"];

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="rules"
      lead="정규 시즌 순위는 서킷 1~4에서 받은 서킷 포인트의 합계로 정합니다."
    >
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="flow">
        <h2 id="flow" className="text-[17px] font-extrabold">
          시즌 진행
        </h2>
        <ol className="mt-3 grid grid-cols-8 gap-2 max-[1100px]:grid-cols-4 max-[760px]:grid-cols-2">
          {FLOW.map((e) => (
            <li key={e.name} className={`rounded-md bg-field px-3 py-2 ${e.points ? "ring-1 ring-accent/60 ring-inset" : ""}`}>
              <b className="block text-[14px]">{e.name}</b>
              <span className="text-[12px] text-fg-3">{e.dates}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="faq">
        <h2 id="faq" className="text-[17px] font-extrabold">
          자주 묻는 질문
        </h2>
        <div className="mt-1 columns-2 gap-8 max-[900px]:columns-1">
          {FAQ.map((f) => (
            <div key={f.q} className="break-inside-avoid border-t border-line-soft py-4 first:border-t-0">
              <h3 className="text-[15px] font-bold">{f.q}</h3>
              {f.a && (
                <p className="mt-1.5 text-[14px] text-fg-2">
                  <Lines text={f.a} />
                </p>
              )}
              {f.extra}
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="standings">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="standings" className="text-[17px] font-extrabold">
            정규 시즌 최종 순위
          </h2>
          <span className="legend">
            {[1, 2, 3, 4].map((c) => (
              <span key={c}>
                <i style={{ background: rampColor(c - 1, 4) }} />
                서킷 {c}
              </span>
            ))}
          </span>
        </div>
        <ol className="mt-3 grid gap-1">
          {season.map((r) => (
            <Fragment key={r.team.key}>
              <li className="grid grid-cols-[30px_190px_minmax(0,1fr)] items-center gap-x-3 py-0.5 max-[760px]:grid-cols-[30px_minmax(0,1fr)] max-[760px]:gap-y-1.5">
                <span className={r.rank <= SEEDS ? "rk adv" : "rk"}>{r.rank}</span>
                <span className={`min-w-0 ${r.rank > QUALIFY ? "text-fg-3" : ""}`}>
                  <TeamName team={r.team} />
                </span>
                <span className="flex items-center gap-2 max-[760px]:col-span-2">
                  <span className="flex h-3.5 min-w-0 flex-1" aria-hidden="true">
                    {r.points.map((p, i) =>
                      p > 0 ? (
                        <span
                          key={i}
                          className="h-full border-r-2 border-surface"
                          style={{ width: `${(p / max) * 100}%`, background: rampColor(i, 4) }}
                          title={`서킷 ${i + 1} ${p}점`}
                        />
                      ) : null,
                    )}
                  </span>
                  <b className="w-12 text-right tabular-nums">{r.total.toLocaleString("ko-KR")}</b>
                </span>
              </li>
              {CUTS[r.rank] && (
                <li className="border-t border-dashed border-line-strong pt-0.5 text-right text-[12px] text-fg-3" aria-hidden="true">
                  {CUTS[r.rank]}
                </li>
              )}
            </Fragment>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-2 items-start gap-4 max-[1280px]:grid-cols-1">
        <section className="panel p-5 max-[760px]:p-4" aria-labelledby="circuit-points">
          <h2 id="circuit-points" className="text-[17px] font-extrabold">
            서킷 포인트
          </h2>
          <KelScroll label="서킷 포인트" className="mt-2">
            <table className="kel-table">
              <thead>
                <tr>
                  <th className="l pin">
                    <span className="sr-only">서킷</span>
                  </th>
                  {ranks.map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {POINT_ROWS.map(([name, points]) => (
                  <tr key={name}>
                    <td className="l pin">{name}</td>
                    {ranks.map((label, i) => (
                      <td key={label}>{(points[i] ?? 0).toLocaleString("ko-KR")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </KelScroll>
        </section>
        <section className="panel p-5 max-[760px]:p-4" aria-labelledby="game-points">
          <h2 id="game-points" className="text-[17px] font-extrabold">
            게임 점수
          </h2>
          <p className="mt-1 text-[14px] text-fg-2">게임 점수는 순위 점수에 킬 점수를 더한 값입니다.</p>
          <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="게임 순위별 순위 점수">
            {PLACEMENT_POINTS.map((p, i) => (
              <li key={i} className="rounded-md bg-field px-3 py-2">
                <span className="block text-[12px] text-fg-3">{i + 1}위</span>
                <b className="text-[17px]">{p}점</b>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </KelPage>
  );
}
