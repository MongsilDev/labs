import Link from "next/link";
import KelPage, { NO_DATA } from "@/er/components/kel/KelPage";
import { Logo } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { int } from "@/er/lib/cut";
import { byText, duration, pct } from "@/er/lib/format";
import { playerPath, seasonStandings, TEAM, wikiUrl } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata, type KelRow } from "@/er/server/kel";
import { DAK_METRICS, gameLabel, killStats, MIN_GAMES, playerStats, rankOf, rankPool, type KillPair, type Metric, type PlayerStat } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("players");

type Tile = [Metric, string, (p: PlayerStat) => string, ((p: PlayerStat) => string)?];

const GROUPS: [string, Tile[]][] = [
  [
    "전투",
    [
      ["kpr", "KPR 평점", (p) => p.kpr.toFixed(3)],
      ["kills", "게임당 킬", (p) => p.kills.toFixed(2)],
      ["deaths", "게임당 데스", (p) => p.deaths.toFixed(2)],
      ["top3", "3위 이내 비율", (p) => pct(p.top3)],
      ["avgPlace", "평균 순위", (p) => `${p.avgPlace.toFixed(2)}위`],
      ["damage", "게임당 가한 피해", (p) => int(p.damage)],
      ["damageShare", "가한 피해 비중", (p) => pct(p.damageShare)],
    ],
  ],
  [
    "지원과 시야",
    [
      ["cc", "게임당 군중제어 시간", (p) => `${p.cc.toFixed(1)}초`],
      ["heal", "게임당 팀원 회복", (p) => int(p.heal)],
      ["vision", "게임당 시야 점수", (p) => p.vision.toFixed(1)],
      ["camera", "게임당 망원 카메라", (p) => `${p.camera.toFixed(1)}개`, (p) => `파괴 ${p.cameraOff.toFixed(1)}개`],
      ["revive", "게임당 동료 부활", (p) => `${p.revive.toFixed(2)}번`],
      ["time", "평균 생존 시간", (p) => duration(p.time)],
    ],
  ],
];

const BESTS: [string, (p: PlayerStat) => KelRow | null, (r: KelRow) => string][] = [
  ["킬", (p) => p.bests.kills, (r) => `${r.kills}킬`],
  ["가한 피해", (p) => p.bests.damage, (r) => int(r.damage)],
  ["군중제어 시간", (p) => p.bests.cc, (r) => `${r.dak!.cc.toFixed(1)}초`],
  ["팀원 회복", (p) => p.bests.heal, (r) => int(r.dak!.heal)],
];

// 횟수가 같으면 이름 순으로 세 명까지
const opponents = (list: KillPair[], side: "killer" | "victim") =>
  [...list]
    .sort((a, b) => b.count - a.count || byText(a[side].player, b[side].player))
    .slice(0, 3)
    .map((r) => ({ r }));

function Opponents({ title, list, side }: { title: string; list: { r: KillPair }[]; side: "killer" | "victim" }) {
  return (
    <div className="min-w-0">
      <h3 className="text-[13px] font-semibold text-fg-3">{title}</h3>
      <ul className="mt-2 grid gap-1.5 text-[14px]">
        {list.map(({ r }) => {
          const o = r[side];
          return (
            <li key={o.player} className="flex min-w-0 items-center gap-2">
              <Logo team={TEAM.get(o.team)!} size={22} label />
              <Link className="truncate font-semibold decoration-line-strong underline-offset-[3px] hover:decoration-fg-3" href={playerPath(o.player)}>
                {o.player}
              </Link>
              <span className="ml-auto text-fg-3">{r.count}번</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Card({ p, all, pairs }: { p: PlayerStat; all: PlayerStat[]; pairs: KillPair[] }) {
  const team = TEAM.get(p.team)!;
  const victims = opponents(pairs.filter((x) => x.killer.player === p.name), "victim");
  const killers = opponents(pairs.filter((x) => x.victim.player === p.name), "killer");
  return (
    <section className="panel grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 p-6 max-[860px]:grid-cols-1 max-[760px]:p-4" aria-labelledby="player">
      <div className="min-w-0">
        <div className="flex items-center gap-4">
          <Logo team={team} size={56} />
          <div className="min-w-0">
            <a className="inline-block py-1 text-[14px] text-fg-2 decoration-line-strong underline-offset-[3px] hover:decoration-fg-3" href={wikiUrl(team.wiki)}>
              {team.name}
            </a>
            <h2 id="player" className="truncate text-[34px] leading-tight font-extrabold tracking-[-0.5px] max-[760px]:text-[28px]">
              <a className="decoration-line-strong underline-offset-[5px] hover:decoration-fg-3" href={wikiUrl(p.name)}>
                {p.name}
              </a>
            </h2>
          </div>
        </div>
        <p className="mt-4 text-fg-2">
          2026 시즌 {p.games}게임에 출전해 1위를 {p.wins}번 차지했습니다.
        </p>
        <h3 className="mt-5 text-[13px] font-semibold text-fg-3">많이 고른 실험체</h3>
        <ul className="mt-2 grid gap-2">
          {p.characters.slice(0, 4).map(([c, n]) => (
            <li key={c} className="flex items-center justify-between gap-3 text-[15px]">
              <Char name={c} />
              <span className="text-fg-3">{n}게임</span>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 border-t border-line-soft pt-4 text-[13px] font-semibold text-fg-3">개인 최고 기록</h3>
        <ul className="@container mt-2 grid gap-2 text-[14px]">
          {BESTS.map(([label, row, value]) => {
            const r = row(p);
            return (
              r && (
                <li key={label} className="grid grid-cols-[6rem_4.5rem_auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 @max-[480px]:grid-cols-[6rem_4.5rem_minmax(0,1fr)]">
                  <span className="text-fg-3">{label}</span>
                  <b className="text-right tabular-nums">{value(r)}</b>
                  <Char name={r.character} />
                  <span className="text-right text-[13px] text-fg-3 @max-[480px]:col-span-2 @max-[480px]:col-start-2 @max-[480px]:text-left">{gameLabel(r)}</span>
                </li>
              )
            );
          })}
        </ul>
        {(victims.length > 0 || killers.length > 0) && (
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line-soft pt-4 max-[420px]:grid-cols-1">
            <Opponents title="많이 처치한 상대" list={victims} side="victim" />
            <Opponents title="이 선수를 많이 처치한 상대" list={killers} side="killer" />
          </div>
        )}
      </div>
      <div className="grid content-start gap-5">
        {GROUPS.filter(([, tiles]) => p.dakGames > 0 || !tiles.every(([m]) => DAK_METRICS.has(m))).map(([title, tiles]) => (
          <section key={title} aria-label={title}>
            <h3 className="text-[13px] font-semibold text-fg-3">
              {title}
              {title === GROUPS[0][0] && <span className="ml-2 font-normal">순위는 {MIN_GAMES}게임 이상 출전한 선수 기준</span>}
            </h3>
            <dl className="mt-2 grid grid-cols-3 gap-3 max-[560px]:grid-cols-2 max-[420px]:gap-2">
              {tiles.map(([m, label, value, sub]) => {
                const rank = rankOf(all, p, m);
                return (
                  <div key={m} className="rounded-lg bg-field px-4 py-3.5 max-[420px]:px-3">
                    <dt className="text-[13px] text-fg-3">{label}</dt>
                    <dd className="mt-1 text-[26px] leading-tight font-extrabold max-[420px]:text-[22px]">{value(p)}</dd>
                    {rank !== null && (
                      <dd className="mt-0.5 text-[13px] font-semibold text-accent-text">
                        {rankPool(all, m)}명 중 {rank}위
                      </dd>
                    )}
                    {sub && <dd className="mt-0.5 text-[13px] text-fg-3">{sub(p)}</dd>}
                  </div>
                );
              })}
            </dl>
          </section>
        ))}
      </div>
    </section>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { user, owner } = await kelGate("players");
  const q = await searchParams;
  const data = kelData();
  const all = data ? playerStats(data) : [];
  if (!data || !all.length) return <KelPage user={user} owner={owner} screen="players" missing={NO_DATA} />;
  const byTeam = seasonStandings()
    .map((r) => ({ team: r.team, players: all.filter((p) => p.team === r.team.key).sort((a, b) => b.games - a.games) }))
    .filter((t) => t.players.length);
  const picked = q.p === undefined ? byTeam[0].players[0] : all.find((p) => p.name === q.p);

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="players"
      notes={[
        `순위는 ${MIN_GAMES}게임 이상 출전한 선수끼리 비교해 매겼고, 평균 순위와 게임당 데스는 값이 작을수록 순위가 높습니다.`,
        "KPR은 경기 기록에 적힌 선수 평점의 평균이고, 한 게임 평균은 약 1.0입니다.",
        "가한 피해 비중은 팀 세 명이 가한 피해에서 그 선수가 차지한 비율을 게임마다 구해 평균한 값입니다.",
        "많이 처치한 상대와 이 선수를 많이 처치한 상대에서는 상대 선수를 알 수 없는 처치를 제외했습니다.",
      ]}
    >
      {picked && <Card p={picked} all={all} pairs={killStats(data).pairs} />}
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="player-list">
        <h2 id="player-list" className="text-[17px] font-extrabold">
          선수 {all.length}명
        </h2>
        <ul className="mt-3 columns-2 gap-x-6 max-[760px]:columns-1">
          {byTeam.map(({ team, players }) => (
            <li key={team.key} className="mb-3 flex min-w-0 break-inside-avoid items-start gap-3">
              <Logo team={team} size={28} label />
              <div className="flex min-w-0 flex-wrap gap-1.5">
                {players.map((p) => (
                  <Link
                    key={p.name}
                    href={playerPath(p.name)}
                    aria-current={p.name === picked?.name ? "page" : undefined}
                    className="chip h-7 no-underline hover:border-line-strong aria-[current=page]:border-accent aria-[current=page]:text-accent-text"
                  >
                    {p.name}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </KelPage>
  );
}
