import HeatCell from "@/er/components/kel/HeatCell";
import KelPage, { KelScroll, NO_DATA } from "@/er/components/kel/KelPage";
import { Logo, PlayerName, TeamName } from "@/er/components/kel/Team";
import { int } from "@/er/lib/cut";
import { byText } from "@/er/lib/format";
import { josa, seasonStandings, TEAM } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { killStats, ranked } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("kills");

const TOP = 10;

export default async function Page() {
  const { user, owner } = await kelGate("kills");
  const data = kelData();
  const stats = data ? killStats(data) : null;
  if (!stats?.pairs.length) return <KelPage user={user} owner={owner} screen="kills" missing={NO_DATA} />;
  const sorted = [...stats.pairs].sort((a, b) => byText(a.killer.player, b.killer.player) || byText(a.victim.player, b.victim.player));
  const pairs = ranked(sorted, (p) => p.count, TOP);
  const teams = seasonStandings()
    .map((r) => r.team)
    .filter((t) => [...stats.together.keys()].some((k) => k.startsWith(`${t.key}|`)));
  const kills = (a: string, b: string) => stats.teams.get(`${a}|${b}`) ?? 0;
  const max = Math.max(...stats.teams.values());
  const unmet = teams.some((a) => teams.some((b) => a !== b && !stats.together.get(`${a.key}|${b.key}`)));

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="kills"
      notes={[
        `처치마다 상대 선수는 처치 기록에 적힌 실험체와 사망 기록을 맞춰 찾았고, 상대를 찾지 못한 처치는 빼서 전체 처치 ${int(stats.total)}번 가운데 ${int(stats.counted)}번만 집계했습니다.`,
        unmet && "같은 게임에 출전한 적이 없는 두 팀의 칸은 -로 표시했습니다.",
      ]}
    >
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="top-pairs">
        <h2 id="top-pairs" className="text-[17px] font-extrabold">
          같은 상대를 많이 처치한 기록 상위 {pairs.length}쌍
        </h2>
        <KelScroll label={`같은 상대를 많이 처치한 기록 상위 ${pairs.length}쌍`} className="mt-3">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l w-10">
                  <span className="sr-only">순위</span>
                </th>
                <th className="l">처치한 선수</th>
                <th className="l wide">처치한 팀</th>
                <th className="l">처치당한 선수</th>
                <th className="l wide">처치당한 팀</th>
                <th>횟수</th>
                <th className="w-full max-[760px]:hidden" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {/* 팀 칸이 보이는 761px 이상에서는 선수 칸 로고를 숨김 */}
              {pairs.map(({ r, rank }) => (
                <tr key={`${r.killer.player}|${r.victim.player}`}>
                  <td className="l">
                    <span className="rk">{rank}</span>
                  </td>
                  <td className="l max-w-[180px]">
                    <PlayerName name={r.killer.player} team={TEAM.get(r.killer.team)} logoClass="min-[761px]:hidden" />
                    <span className="narrow mt-0.5 text-[12px] text-fg-3">{TEAM.get(r.killer.team)!.name}</span>
                  </td>
                  <td className="l wide max-w-[200px]">
                    <TeamName team={TEAM.get(r.killer.team)!} size={22} />
                  </td>
                  <td className="l max-w-[180px]">
                    <PlayerName name={r.victim.player} team={TEAM.get(r.victim.team)} logoClass="min-[761px]:hidden" />
                    <span className="narrow mt-0.5 text-[12px] text-fg-3">{TEAM.get(r.victim.team)!.name}</span>
                  </td>
                  <td className="l wide max-w-[200px]">
                    <TeamName team={TEAM.get(r.victim.team)!} size={22} />
                  </td>
                  <td className="font-bold">{r.count}번</td>
                  <td className="max-[760px]:hidden" aria-hidden="true" />
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="team-kills">
        <h2 id="team-kills" className="text-[17px] font-extrabold">
          팀끼리 처치한 횟수
        </h2>
        <p className="mt-1 text-[14px] text-fg-2">
          행은 처치한 팀이고, 열은 처치당한 팀입니다.
          <br />칸 위쪽 숫자는 처치한 횟수이고, 아래쪽 숫자는 두 팀이 같은 게임에 출전한 횟수입니다.
          <br />칸 색이 진할수록 처치 횟수가 많습니다.
        </p>
        <KelScroll label="팀끼리 처치한 횟수" className="mt-3">
          <table className="kel-table kel-heat">
            <thead>
              <tr>
                <th className="l pin">처치한 팀</th>
                {teams.map((t) => (
                  <th key={t.key} className="text-center">
                    <span className="grid justify-items-center gap-1">
                      <Logo team={t} size={20} />
                      {t.short}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((a) => (
                <tr key={a.key}>
                  <td className="l pin">
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Logo team={a} />
                      <span className="truncate max-[760px]:sr-only">{a.name}</span>
                      <span className="hidden max-[760px]:inline" aria-hidden>
                        {a.short}
                      </span>
                    </span>
                  </td>
                  {teams.map((b) => {
                    const n = kills(a.key, b.key);
                    const met = stats.together.get(`${a.key}|${b.key}`) ?? 0;
                    if (!met) return <HeatCell key={b.key} v={null} />;
                    return (
                      <HeatCell key={b.key} v={max ? n / max : 0}>
                        <span title={`${josa(a.name, "이", "가")} ${josa(b.name, "을", "를")} ${n}번 처치, 같은 게임 ${met}번`}>
                          {n}
                          <span className="block text-[11px] font-normal">{met}</span>
                        </span>
                      </HeatCell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
    </KelPage>
  );
}
