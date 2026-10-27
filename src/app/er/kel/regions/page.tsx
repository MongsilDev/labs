import KelPage, { KelScroll, NO_DAK, NO_DATA } from "@/er/components/kel/KelPage";
import { PlayerName, TeamName } from "@/er/components/kel/Team";
import { int } from "@/er/lib/cut";
import { pct } from "@/er/lib/format";
import { seasonStandings, TEAM, TONES } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { MIN_GAMES, MIN_STARTS, regions } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("regions");

const RANKS = ["1순위", "2순위", "3순위"];

function Areas({ areas }: { areas: [string, number][] }) {
  return RANKS.map((k, i) => (
    <td key={k} className="l">
      {areas[i] && (
        <>
          {areas[i][0]} <span className="text-fg-3">{pct(areas[i][1], 0)}</span>
        </>
      )}
    </td>
  ));
}

export default async function Page() {
  const { user, owner } = await kelGate("regions");
  const data = kelData();
  if (!data) return <KelPage user={user} owner={owner} screen="regions" missing={NO_DATA} />;
  const reg = regions(data);
  if (!reg.starts.length) return <KelPage user={user} owner={owner} screen="regions" missing={NO_DAK} />;
  const starts = reg.starts.filter((s) => s.count > MIN_STARTS);
  const most = reg.deaths[0];
  const deaths = data.rows.reduce((a, r) => a + (r.dak ? r.deaths : 0), 0);
  const counted = reg.deaths.reduce((a, x) => a + x.count, 0);
  const maxDeath = Math.max(1, most?.count ?? 0);
  const order = seasonStandings().map((r) => r.team.key);
  const teams = [...reg.teams].sort((a, b) => order.indexOf(a.team) - order.indexOf(b.team));
  const players = [...reg.players].sort((a, b) => b.areas[0][1] - a.areas[0][1] || b.games - a.games);

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="regions"
      notes={[
        `시작 지역별 팀 순위 표에는 시작 횟수가 ${MIN_STARTS}번을 넘는 지역만 표시했습니다.`,
        `경기 상세에는 게임마다 선수 한 명당 사망 장소가 세 번까지만 기록돼 있어, 전체 사망 ${int(deaths)}번 가운데 ${int(counted)}번만 집계했습니다.`,
        `선수별 표에는 ${MIN_GAMES}게임 이상 출전한 선수만 표시했습니다.`,
      ]}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-5 max-[1080px]:grid-cols-1">
          <section className="panel p-5 max-[760px]:p-4" aria-labelledby="start-rank">
            <h2 id="start-rank" className="text-[17px] font-extrabold">
              시작 지역별 팀 순위
            </h2>
            <KelScroll label="시작 지역별 팀 순위" className="mt-3">
              <table className="kel-table">
                <thead>
                  <tr>
                    <th className="l">지역</th>
                    <th>시작</th>
                    <th>평균 순위</th>
                    <th>3위 이내</th>
                  </tr>
                </thead>
                <tbody>
                  {starts.map((s) => (
                    <tr key={s.area}>
                      <td className="l font-semibold">{s.area}</td>
                      <td>{s.count}</td>
                      <td className="font-bold">{s.avgPlace.toFixed(2)}위</td>
                      <td>{pct(s.top3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KelScroll>
          </section>
          <section className="panel p-5 max-[760px]:p-4" aria-labelledby="deaths">
            <h2 id="deaths" className="text-[17px] font-extrabold">
              사망이 많았던 지역
            </h2>
            <p className="mt-1 text-[13px] text-fg-3">굵은 숫자는 사망 수이고, 오른쪽 숫자는 그 지역에서 시작한 횟수입니다.</p>
            <ul className="mt-4 grid grid-cols-[88px_minmax(0,1fr)_auto_auto] gap-x-3 gap-y-2.5 text-[14px]">
              {reg.deaths.map((x) => (
                <li key={x.area} className="col-span-4 grid grid-cols-subgrid items-center">
                  <span className="font-semibold">{x.area}</span>
                  <span className="h-2.5 rounded-r-[4px]" style={{ width: `${(x.count / maxDeath) * 100}%`, background: TONES[1] }} aria-hidden="true" />
                  <b className="text-right tabular-nums">{int(x.count)}</b>
                  <span className="text-right text-[12px] text-fg-3 tabular-nums">시작 {x.starts}번</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel col-span-full p-5 max-[760px]:p-4" aria-labelledby="team-starts">
            <h2 id="team-starts" className="text-[17px] font-extrabold">
              팀별로 많이 시작한 지역
            </h2>
            <KelScroll label="팀별로 많이 시작한 지역" className="mt-3">
              <table className="kel-table">
                <thead>
                  <tr>
                    <th className="l pin">팀</th>
                    {RANKS.map((k) => (
                      <th key={k} className="l">
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.team}>
                      <td className="l pin max-w-[180px]">
                        <TeamName team={TEAM.get(t.team)!} />
                      </td>
                      <Areas areas={t.areas} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </KelScroll>
          </section>
        <section className="panel col-span-full p-5 max-[760px]:p-4" aria-labelledby="player-starts">
          <h2 id="player-starts" className="text-[17px] font-extrabold">
            선수별로 많이 시작한 지역
          </h2>
          <KelScroll label="선수별로 많이 시작한 지역" className="mt-3">
            <table className="kel-table">
              <thead>
                <tr>
                  <th className="l pin">선수</th>
                  <th>게임</th>
                  {RANKS.map((k) => (
                    <th key={k} className="l">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.name}>
                    <td className="l pin max-w-[160px]">
                      <PlayerName name={p.name} team={TEAM.get(p.team)} />
                    </td>
                    <td className="text-fg-3">{p.games}</td>
                    <Areas areas={p.areas} />
                  </tr>
                ))}
              </tbody>
            </table>
          </KelScroll>
        </section>
      </div>
    </KelPage>
  );
}
