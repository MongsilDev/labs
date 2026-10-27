import { Best, Bests } from "@/er/components/kel/Best";
import KelPage, { KelScroll, KelTabs, NO_DATA, pickTab } from "@/er/components/kel/KelPage";
import { Logo, PlayerName } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { int } from "@/er/lib/cut";
import { fmt } from "@/er/lib/format";
import { playerPath, TEAM } from "@/er/lib/kel";
import { placementPoints } from "@/er/lib/kel-calc";
import { kelData, kelGate, kelMetadata, type KelRow, type TeamGame } from "@/er/server/kel";
import { gameLabel, lows, records } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("records");

const VIEWS: ["season" | "characters" | "low", string][] = [
  ["season", "시즌 전체"],
  ["characters", "실험체별"],
  ["low", "부진한 기록"],
];

const chunks = <T,>(list: T[], n: number) => {
  const size = Math.ceil(list.length / n);
  return Array.from({ length: n }, (_, i) => list.slice(i * size, (i + 1) * size)).filter((x) => x.length);
};

function TeamWho({ g, detail }: { g: TeamGame; detail?: string }) {
  const team = TEAM.get(g.team)!;
  return (
    <div className="mt-1 grid gap-1">
      <p className="flex items-center gap-1.5 text-[15px] font-bold">
        <Logo team={team} size={22} />
        {team.name}
      </p>
      <p className="text-[13px] leading-relaxed text-fg-3">
        {gameLabel(g)}
        {detail && (
          <>
            <br />
            {detail}
          </>
        )}
      </p>
    </div>
  );
}

function Ranking({ id, title, rows, label, value }: { id: string; title: string; rows: { r: KelRow; rank: number }[]; label: string; value: (r: KelRow) => React.ReactNode }) {
  return (
    <section className="panel p-5 max-[760px]:p-4" aria-labelledby={id}>
      <h2 id={id} className="text-[17px] font-extrabold">
        {title}
      </h2>
      <KelScroll label={title} className="mt-3">
        <table className="kel-table">
          <thead>
            <tr>
              <th className="l w-10">
                <span className="sr-only">순위</span>
              </th>
              <th className="l">선수</th>
              <th className="l wide">실험체</th>
              <th className="l wide">경기</th>
              <th>팀 순위</th>
              <th className="wide">킬</th>
              <th>{label}</th>
              <th className="w-full max-[760px]:hidden" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, rank }) => (
              <tr key={`${r.gameId}-${r.player}`}>
                <td className="l">
                  <span className="rk">{rank}</span>
                </td>
                <td className="l">
                  <PlayerName name={r.player} team={TEAM.get(r.team)} />
                  <span className="narrow mt-0.5 text-[12px] text-fg-3">{gameLabel(r)}</span>
                </td>
                <td className="l wide">
                  <Char name={r.character} />
                </td>
                <td className="l wide text-fg-2">{gameLabel(r)}</td>
                <td>{r.placement}위</td>
                <td className="wide">{r.kills}</td>
                <td className="font-bold">{value(r)}</td>
                <td className="max-[760px]:hidden" aria-hidden="true" />
              </tr>
            ))}
          </tbody>
        </table>
      </KelScroll>
    </section>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user, owner } = await kelGate("records");
  const view = pickTab(VIEWS, (await searchParams).view);
  const data = kelData();
  if (!data) return <KelPage user={user} owner={owner} screen="records" missing={NO_DATA} />;
  const rec = records(data);
  const low = view === "low" ? lows(data) : null;

  return (
    <KelPage user={user} owner={owner} screen="records" notes={low ? "같은 값은 같은 순위로 묶고, 같은 순위 안에서는 경기가 열린 순서대로 표시했습니다." : undefined}>
      <KelTabs screen="records" param="view" label="보기" items={VIEWS} current={view} />
      {view === "season" && (
        <>
          <section className="grid grid-cols-5 gap-3 max-[1280px]:grid-cols-2" aria-label="한 게임 최고 기록">
            <Bests rec={rec} keys={["kills", "damage", "taken", "lowTeamDamage", "cc", "heal", "camera", "vision"]} href={(r) => playerPath(r.player)} />
            <Best label="팀 킬" value={rec.teamKills.kills} unit="킬">
              <TeamWho g={rec.teamKills} />
            </Best>
            <Best label="팀 게임 점수" value={fmt(rec.teamScore.value)} unit="점">
              {rec.teamScore.games.map((s) => (
                <TeamWho key={`${s.gameId}-${s.team}`} g={s} detail={`순위\u00a0점수\u00a0${placementPoints(s.placement)} + 킬\u00a0점수\u00a0${fmt(s.killScore)}`} />
              ))}
            </Best>
          </section>
          <Ranking id="top-damage" title={`가한 피해 상위 ${rec.damage.length}개 기록`} rows={rec.damage} label="가한 피해" value={(r) => int(r.damage)} />
        </>
      )}
      {low && (
        <>
          <Ranking id="low-damage" title="가한 피해" rows={low.damage} label="가한 피해" value={(r) => int(r.damage)} />
          <Ranking id="most-deaths" title="데스" rows={low.deaths} label="데스" value={(r) => r.deaths} />
        </>
      )}
      {view === "characters" && (
        // 이름순 목록이라 세로로 나눠 열마다 위에서 아래로 읽힘
        <section className="panel grid grid-cols-3 gap-x-8 p-5 max-[1080px]:grid-cols-1 max-[760px]:p-4">
          {chunks(rec.characters, 3).map((part, i) => (
            <KelScroll key={i} label={`실험체별 한 게임 최고 기록 ${i + 1}`}>
              <table className={`kel-table ${i > 0 ? "max-[1080px]:[&_thead]:hidden" : ""}`}>
                <thead>
                  <tr>
                    <th className="l">실험체</th>
                    <th>킬</th>
                    <th>가한 피해</th>
                  </tr>
                </thead>
                <tbody>
                  {part.map((c) => (
                    <tr key={c.key}>
                      <td className="l">
                        <Char name={c.key} />
                      </td>
                      <td>
                        <span className="grid justify-items-end">
                          <b>{c.kills.kills}킬</b>
                          <PlayerName name={c.kills.player} />
                        </span>
                      </td>
                      <td>
                        <span className="grid justify-items-end">
                          <b>{int(c.damage.damage)}</b>
                          <PlayerName name={c.damage.player} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </KelScroll>
          ))}
        </section>
      )}
    </KelPage>
  );
}
