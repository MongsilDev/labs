import KelPage, { KelScroll, KelTabs, NO_DAK, NO_DATA, pickTab } from "@/er/components/kel/KelPage";
import Scatter from "@/er/components/kel/Scatter";
import { TeamName } from "@/er/components/kel/Team";
import { duration, pct } from "@/er/lib/format";
import { KEL_EVENTS, KEL_SCREENS, seasonStandings, TEAM, TONES } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { teamOps, teamStyles, type StyleScope, type TeamOps, type TeamStyle } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("teams");

const SCOPES: [StyleScope, string][] = [["season", "시즌 전체"], ...KEL_EVENTS.map((e): [StyleScope, string] => [e.key, e.name]), ["finals", "모든 결승"]];

const VIEWS: ["score" | "ops", string][] = [
  ["score", "점수"],
  ["ops", "운영"],
];

const OPS_NOTES = [
  "위클라인 처치는 그 팀 선수가 위클라인을 처치해 크레딧을 받은 게임 수입니다.",
  "평균 생존 시간은 게임마다 팀에서 가장 오래 생존한 선수의 생존 시간을 평균한 값입니다.",
  "게임당 시야 점수와 망원 카메라 설치 수는 팀 세 명의 합계입니다.",
  "탈출은 팀 세 명이 모두 탈출로 기록된 게임 수입니다.",
];

const name = (k: string) => TEAM.get(k)!.name;

// 범위와 보기 탭이 서로의 값을 잃지 않도록 기본값이 아닌 것만 주소에 남김
function href(scope: StyleScope, view: (typeof VIEWS)[number][0]) {
  const q = new URLSearchParams();
  if (scope !== SCOPES[0][0]) q.set("s", scope);
  if (view !== VIEWS[0][0]) q.set("v", view);
  return q.size ? `${KEL_SCREENS.teams.path}?${q}` : KEL_SCREENS.teams.path;
}

function Score({ rows, scope }: { rows: TeamStyle[]; scope: StyleScope }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5 max-[1280px]:grid-cols-1">
      <section className="panel p-5 max-[760px]:p-4 min-[1281px]:sticky min-[1281px]:top-6" aria-label="게임당 순위 점수와 킬 점수">
        <Scatter
          key={scope}
          points={rows.map((r) => ({
            key: r.team,
            x: r.rankPerGame,
            y: r.killPerGame,
            name: name(r.team),
            team: r.team,
            info: [`${r.games}게임, 1위 ${r.wins}번`, `게임당 순위 점수 ${r.rankPerGame.toFixed(2)}`, `게임당 킬 점수 ${r.killPerGame.toFixed(2)}`],
          }))}
          xLabel="게임당 순위 점수"
          yLabel="게임당 킬 점수"
          format="num"
        />
      </section>
      <section className="panel p-5 max-[760px]:p-4">
        <KelScroll label="팀별 기록">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l pin">팀</th>
                <th>게임</th>
                <th>1위</th>
                <th>8위</th>
                <th className="wide">3위 이내</th>
                <th>
                  킬 점수
                  <br />
                  비중
                </th>
                <th className="wide">순위 점수</th>
                <th className="wide">킬 점수</th>
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team}>
                  <td className="l pin max-w-[180px]">
                    <TeamName team={TEAM.get(r.team)!} />
                  </td>
                  <td>{r.games}</td>
                  <td>{r.wins}</td>
                  <td>{r.eighth}</td>
                  <td className="wide">{pct(r.top3)}</td>
                  <td>{pct(r.killShare)}</td>
                  <td className="wide">{r.rankPerGame.toFixed(2)}</td>
                  <td className="wide">{r.killPerGame.toFixed(2)}</td>
                  <td className="font-bold">{r.perGame.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
    </div>
  );
}

function Ops({ rows, ranks }: { rows: TeamOps[]; ranks: number[] }) {
  const order = seasonStandings().map((r) => r.team.key);
  const list = [...rows].sort((a, b) => order.indexOf(a.team) - order.indexOf(b.team));
  const max = Math.max(1, ...ranks);
  const games = ranks.reduce((a, n) => a + n, 0);
  return (
    <>
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="ops">
        <h2 id="ops" className="text-[17px] font-extrabold">
          팀별 기록
        </h2>
        <KelScroll label="팀별 기록" className="mt-3">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l pin">팀</th>
                <th>게임</th>
                <th>위클라인 처치</th>
                <th>
                  처치한 게임
                  <br />
                  평균 순위
                </th>
                <th>평균 생존 시간</th>
                <th>
                  게임당
                  <br />
                  시야 점수
                </th>
                <th>
                  게임당
                  <br />
                  망원 카메라
                </th>
                <th>탈출</th>
                <th className="l">많이 시작한 지역</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.team}>
                  <td className="l pin max-w-[180px]">
                    <TeamName team={TEAM.get(r.team)!} />
                  </td>
                  <td>{r.games}</td>
                  <td className="font-bold">{r.wickline}</td>
                  <td>{r.wicklinePlace === null ? "-" : `${r.wicklinePlace.toFixed(2)}위`}</td>
                  <td>{duration(r.time)}</td>
                  <td>{r.vision.toFixed(1)}</td>
                  <td>{r.camera.toFixed(1)}</td>
                  <td>{r.escaped}</td>
                  <td className="l">
                    {r.start && (
                      <>
                        {r.start[0]} <span className="text-fg-3">{pct(r.start[1], 0)}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="wick-ranks">
        <h2 id="wick-ranks" className="flex flex-wrap items-baseline gap-x-3 text-[17px] font-extrabold">
          위클라인을 처치한 팀의 순위
          {games > 0 && <span className="text-[14px] font-semibold text-fg-3">평균 {(ranks.reduce((a, n, i) => a + n * (i + 1), 0) / games).toFixed(2)}위</span>}
        </h2>
        <ol className="mt-4 grid grid-cols-8 items-end gap-3 max-[760px]:gap-1.5">
          {ranks.map((n, i) => (
            <li key={i} className="grid justify-items-center gap-1.5 text-[13px]">
              <b className="text-[15px]">{n}</b>
              <span className="w-full max-w-[72px] rounded-t-[4px]" style={{ height: Math.max(2, (n / max) * 140), background: TONES[0], opacity: i === 0 ? 1 : 0.45 }} aria-hidden="true" />
              <span className="text-fg-3">{i + 1}위</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string; v?: string }> }) {
  const { user, owner } = await kelGate("teams");
  const q = await searchParams;
  const scope = pickTab(SCOPES, q.s);
  const view = pickTab(VIEWS, q.v);
  const data = kelData();
  const rows = data ? teamStyles(data, scope) : [];
  if (!data || !rows.length) return <KelPage user={user} owner={owner} screen="teams" lead={NO_DATA} />;
  const tabs = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <KelTabs label="범위" items={SCOPES} current={scope} href={(s) => href(s, view)} />
      <KelTabs label="보기" items={VIEWS} current={view} href={(v) => href(scope, v)} />
    </div>
  );

  if (view === "ops") {
    const { rows: ops, ranks } = teamOps(data, scope);
    if (!ops.length) {
      return (
        <KelPage user={user} owner={owner} screen="teams" lead={NO_DAK}>
          {tabs}
        </KelPage>
      );
    }
    return (
      <KelPage user={user} owner={owner} screen="teams" notes={[...OPS_NOTES, ops.some((r) => r.wicklinePlace === null) && "위클라인을 처치한 게임이 없는 팀은 평균 순위를 -로 표시했습니다."]}>
        {tabs}
        <Ops rows={ops} ranks={ranks} />
      </KelPage>
    );
  }

  return (
    <KelPage user={user} owner={owner} screen="teams" notes="점수는 모두 게임당 평균이고, 감점은 반영하지 않았습니다.">
      {tabs}
      <Score rows={rows} scope={scope} />
    </KelPage>
  );
}
