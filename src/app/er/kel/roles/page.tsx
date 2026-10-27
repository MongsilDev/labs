import KelPage, { KelScroll, NO_DATA } from "@/er/components/kel/KelPage";
import Scatter from "@/er/components/kel/Scatter";
import { PlayerName } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { int } from "@/er/lib/cut";
import { pct } from "@/er/lib/format";
import { seasonStandings, TEAM, TONES } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { MIN_GAMES, playerStats, type PlayerStat } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("roles");

const TOP = 5;

// per는 비중 옆에 함께 보여 주는 게임당 값
function Top({ id, title, rows, value, per }: { id: string; title: string; rows: PlayerStat[]; value: (p: PlayerStat) => number; per?: [string, (p: PlayerStat) => string] }) {
  return (
    <section className="panel p-5 max-[760px]:p-4" aria-labelledby={id}>
      <h2 id={id} className="text-[17px] font-extrabold">
        {title}
      </h2>
      <KelScroll label={title} className="mt-3">
        <table className="kel-table">
          <thead>
            <tr>
              <th className="l">선수</th>
              <th className="l wide">많이 고른 실험체</th>
              <th>비중</th>
              {per && <th className="wide">{per[0]}</th>}
              <th>게임</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.name}>
                <td className="l max-w-[180px]">
                  <PlayerName name={p.name} team={TEAM.get(p.team)} />
                </td>
                <td className="l wide">
                  <Char name={p.characters[0][0]} />
                </td>
                <td className="font-bold">{pct(value(p))}</td>
                {per && <td className="wide">{per[1](p)}</td>}
                <td className="text-fg-3">{p.games}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </KelScroll>
    </section>
  );
}

export default async function Page() {
  const { user, owner } = await kelGate("roles");
  const data = kelData();
  const players = data ? playerStats(data).filter((p) => p.games >= MIN_GAMES) : [];
  if (!players.length) return <KelPage user={user} owner={owner} screen="roles" lead={NO_DATA} />;
  const taken = [...players].sort((a, b) => b.takenShare - a.takenShare).slice(0, TOP);
  const damage = [...players].sort((a, b) => b.damageShare - a.damageShare).slice(0, TOP);
  const cc = [...players].sort((a, b) => b.ccShare - a.ccShare).slice(0, TOP);
  const heal = [...players].sort((a, b) => b.healShare - a.healShare).slice(0, TOP);
  // 경기 상세가 없으면 두 비중이 모두 0이라 표와 문장을 숨김
  const support = players.some((p) => p.ccShare > 0 || p.healShare > 0);
  const tone = (p: PlayerStat) => (damage.includes(p) ? 0 : taken.includes(p) ? 1 : undefined);
  const order = seasonStandings().map((r) => r.team.key);
  const all = [...players].sort((a, b) => order.indexOf(a.team) - order.indexOf(b.team) || b.games - a.games);
  let half = Math.ceil(all.length / 2);
  while (half < all.length && all[half].team === all[half - 1].team) half++;

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="roles"
      notes={[
        "비중은 게임마다 팀 세 명의 합계에서 그 선수가 차지한 비율을 평균한 값입니다.",
        support && "팀원 회복은 팀원에게 준 회복량이고, 자기 보호막으로 막은 피해는 포함하지 않았습니다.",
      ]}
    >
      <div className="grid grid-cols-2 items-start gap-5 max-[760px]:grid-cols-1">
        <Top id="top-taken" title={`받은 피해 비중 상위 ${TOP}명`} rows={taken} value={(p) => p.takenShare} />
        <Top id="top-damage" title={`가한 피해 비중 상위 ${TOP}명`} rows={damage} value={(p) => p.damageShare} />
        {support && <Top id="top-cc" title={`군중제어 시간 비중 상위 ${TOP}명`} rows={cc} value={(p) => p.ccShare} per={["게임당 시간", (p) => `${p.cc.toFixed(1)}초`]} />}
        {support && <Top id="top-heal" title={`팀원 회복 비중 상위 ${TOP}명`} rows={heal} value={(p) => p.healShare} per={["게임당 회복량", (p) => int(p.heal)]} />}
        <section className="panel col-span-2 p-5 max-[760px]:col-span-1 max-[760px]:p-4" aria-label="팀이 가한 피해와 받은 피해에서 차지한 비중">
          <span className="legend">
            <span>
              <i style={{ background: TONES[1], width: 10, borderRadius: 999 }} />
              받은 피해 비중 상위 {TOP}명
            </span>
            <span>
              <i style={{ background: TONES[0], width: 10, borderRadius: 999 }} />
              가한 피해 비중 상위 {TOP}명
            </span>
            <span>
              <i className="dash" />
              세 명이 똑같이 나눈 몫 33.3%
            </span>
          </span>
          <div className="mt-3">
            <Scatter
              points={players.map((p) => ({
                key: p.name,
                x: p.damageShare,
                y: p.takenShare,
                name: p.name,
                tone: tone(p),
                info: [TEAM.get(p.team)!.name, `가한 피해 비중 ${pct(p.damageShare)}`, `받은 피해 비중 ${pct(p.takenShare)}`, `${p.games}게임`],
              }))}
              xLabel="가한 피해 비중"
              yLabel="받은 피해 비중"
              format="pct"
              refX={1 / 3}
              refY={1 / 3}
              height={420}
            />
          </div>
        </section>
        <section className="panel col-span-2 p-5 max-[760px]:col-span-1 max-[760px]:p-4" aria-labelledby="all-players">
          <h2 id="all-players" className="text-[17px] font-extrabold">
            {MIN_GAMES}게임 이상 출전한 선수 {players.length}명의 비중
          </h2>
          {/* 팀 순서 목록이라 팀이 두 열에 나뉘지 않는 자리에서 자름 */}
          <div className="mt-3 grid grid-cols-2 gap-x-8 max-[1080px]:grid-cols-1">
            {[all.slice(0, half), all.slice(half)].filter((part) => part.length).map((part, i) => (
              <KelScroll key={i} label={`선수별 비중 ${i + 1}`}>
                <table className={`kel-table ${i > 0 ? "max-[1080px]:[&_thead]:hidden" : ""}`}>
                  <thead>
                    <tr>
                      <th className="l">선수</th>
                      <th>가한 피해</th>
                      <th>받은 피해</th>
                      {support && <th className="wide">군중제어 시간</th>}
                      {support && <th className="wide">팀원 회복</th>}
                      <th>게임</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.map((p) => (
                      <tr key={p.name}>
                        <td className="l max-w-[180px]">
                          <PlayerName name={p.name} team={TEAM.get(p.team)} />
                        </td>
                        <td>{pct(p.damageShare)}</td>
                        <td>{pct(p.takenShare)}</td>
                        {support && <td className="wide">{pct(p.ccShare)}</td>}
                        {support && <td className="wide">{pct(p.healShare)}</td>}
                        <td className="text-fg-3">{p.games}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </KelScroll>
            ))}
          </div>
        </section>
      </div>
    </KelPage>
  );
}
