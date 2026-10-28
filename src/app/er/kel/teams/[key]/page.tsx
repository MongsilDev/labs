import Link from "next/link";
import { notFound } from "next/navigation";
import BumpChart from "@/er/components/kel/BumpChart";
import KelPage, { KelScroll, NO_DATA } from "@/er/components/kel/KelPage";
import Rank from "@/er/components/kel/Rank";
import { Logo } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { duration, pct } from "@/er/lib/format";
import { circuitPoints, KEL_EVENTS, KEL_SCREENS, KEL_TEAMS, playerPath, QUALIFY, SEEDS, seasonStandings, TEAM, teamPath, wikiUrl } from "@/er/lib/kel";
import { placementPoints } from "@/er/lib/kel-calc";
import { CIRCUIT_STAGES, kelData, kelGate, kelMetadata } from "@/er/server/kel";
import { finals, gameLabel, killStats, playerStats, regions, teamOps, teamStyles } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Props) {
  const team = TEAM.get((await params).key);
  const meta = await kelMetadata("teams");
  return team && meta.title ? { ...meta, title: `${team.name} 팀 기록` } : meta;
}

const CIRCUITS = KEL_EVENTS.filter((e) => /^c\d$/.test(e.key)).map((e) => e.name);
const H2 = "text-[17px] font-extrabold";
const SUB = "text-[13px] font-semibold text-fg-3";
const LINK = "decoration-line-strong underline-offset-[3px] hover:decoration-fg-3";

function Tile({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-field px-4 py-3.5 max-[420px]:px-3">
      <dt className="text-[13px] text-fg-3">{label}</dt>
      <dd className="mt-1 text-[26px] leading-tight font-extrabold max-[420px]:text-[22px]">{value}</dd>
      {children}
    </div>
  );
}

// 같은 값은 같은 순위
const rankBy = <T,>(list: T[], me: T, value: (x: T) => number) => 1 + list.filter((x) => value(x) > value(me)).length;

export default async function Page({ params }: Props) {
  const { key } = await params;
  const team = TEAM.get(key);
  if (!team) notFound();
  const { user, owner } = await kelGate("teams");
  const data = kelData();
  if (!data) return <KelPage user={user} owner={owner} screen="teams" title={team.name} missing={NO_DATA} />;
  const season = seasonStandings();
  const me = season.find((r) => r.team.key === key)!;
  const styles = teamStyles(data, "season");
  const style = styles.find((s) => s.team === key)!;
  const styleRank = (v: (s: (typeof styles)[number]) => number) => <Rank pool={styles.length} rank={rankBy(styles, style, v)} unit="팀" />;
  const status = me.rank <= SEEDS ? "결승에 직행했습니다" : me.rank <= QUALIFY ? "준결승에 진출했습니다" : "챔피언십에 진출하지 못했습니다";

  const games = data.games.filter((g) => g.team === key);
  const events = KEL_EVENTS.map((e) => {
    const list = games.filter((g) => g.event === e.key);
    // 오프닝 위크 단계는 CIRCUIT_STAGES에 없어 첫 단계 이름을 그대로 씀
    const last = list.reduce((a, g) => (CIRCUIT_STAGES.indexOf(g.stage as never) > CIRCUIT_STAGES.indexOf(a as never) ? g.stage : a), list[0]?.stage);
    return { e, list, last };
  }).filter((x) => x.list.length);
  const finalRank = new Map(finals(data).filter((f) => f.teams.includes(key)).map((f) => [f.event, f.state.rows.findIndex((r) => r.key === key) + 1]));

  const players = playerStats(data)
    .filter((p) => p.team === key)
    .sort((a, b) => b.games - a.games);
  const picks = [...Map.groupBy(games.flatMap((g) => g.characters), (c) => c)]
    .map(([c, l]) => [c, l.length] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const combos = [...Map.groupBy(games.filter((g) => g.characters.length === 3), (g) => [...g.characters].sort().join("|"))]
    .map(([k, l]) => ({ chars: k.split("|"), n: l.length, avg: l.reduce((a, g) => a + g.placement, 0) / l.length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);

  const ops = teamOps(data, "season").rows;
  const op = ops.find((r) => r.team === key);
  const opRank = (v: (r: (typeof ops)[number]) => number) => op && <Rank pool={ops.length} rank={rankBy(ops, op, v)} unit="팀" />;
  const areas = regions(data).teams.find((t) => t.team === key)?.areas ?? [];

  const ks = killStats(data);
  const vs = KEL_TEAMS.filter((t) => t.key !== key).map((t) => ({ t, out: ks.teams.get(`${key}|${t.key}`) ?? 0, in: ks.teams.get(`${t.key}|${key}`) ?? 0 }));
  const most = (f: (x: (typeof vs)[number]) => number) => [...vs].sort((a, b) => f(b) - f(a)).slice(0, 3);

  const score = (g: (typeof games)[number]) => placementPoints(g.placement) + g.killScore;
  const best = [...games].sort((a, b) => score(b) - score(a))[0];
  const kills = [...games].sort((a, b) => b.kills - a.kills)[0];

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="teams"
      head={
        <div className="flex items-center gap-4">
          <Logo team={team} size={64} label />
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight font-extrabold tracking-[-0.5px] max-[760px]:text-[24px]">
              <a className="decoration-line-strong underline-offset-[5px] hover:decoration-fg-3" href={wikiUrl(team.wiki)}>
                {team.name}
              </a>
            </h1>
            <p className="mt-1 text-fg-2">
              정규 시즌 {me.rank}위, 서킷 포인트 {me.total.toLocaleString("ko-KR")}점으로 {status}.
            </p>
          </div>
        </div>
      }
      notes={["처치 관계에서는 상대 선수를 알 수 없는 처치를 제외했습니다.", "운영 기록은 팀 세 명 모두 경기 상세가 있는 게임만 셌습니다."]}
    >
      <section className="panel p-5 max-[760px]:p-4" aria-label="시즌 요약">
        <dl className="grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-[420px]:gap-2">
          <Tile label="게임" value={String(style.games)}>
            <dd className="mt-0.5 text-[13px] text-fg-3">1위 {style.wins}번</dd>
          </Tile>
          <Tile label="3위 이내 비율" value={pct(style.top3)}>
            {styleRank((s) => s.top3)}
          </Tile>
          <Tile label="게임당 점수" value={style.perGame.toFixed(2)}>
            {styleRank((s) => s.perGame)}
          </Tile>
          <Tile label="킬 점수 비중" value={pct(style.killShare)}>
            {styleRank((s) => s.killShare)}
          </Tile>
        </dl>
      </section>

      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="circuits">
        <h2 id="circuits" className={H2}>
          서킷별 순위
        </h2>
        <KelScroll label="서킷별 순위" className="mt-3">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l">
                  <span className="sr-only">항목</span>
                </th>
                {CIRCUITS.map((c) => (
                  <th key={c}>{c}</th>
                ))}
                <th>합계</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="l text-fg-3">순위</td>
                {team.circuits.map((r, i) => (
                  <td key={i} className={r === 1 ? "font-bold" : undefined}>
                    {r}위
                  </td>
                ))}
                <td className="font-bold">{me.rank}위</td>
              </tr>
              <tr>
                <td className="l text-fg-3">포인트</td>
                {team.circuits.map((r, i) => (
                  <td key={i}>{circuitPoints(i + 1, r).toLocaleString("ko-KR")}</td>
                ))}
                <td className="font-bold">{me.total.toLocaleString("ko-KR")}</td>
              </tr>
            </tbody>
          </table>
        </KelScroll>
        <h3 className={`mt-5 ${SUB}`}>누적 순위</h3>
        <div className="mt-2">
          <BumpChart rows={season.map((r) => ({ key: r.team.key, ranks: r.ranks }))} labels={CIRCUITS} initial={[key]} legend="" suffix="까지" />
        </div>
      </section>

      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="events">
        <h2 id="events" className={H2}>
          대회별 기록
        </h2>
        <KelScroll label="대회별 기록" className="mt-3">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l pin">대회</th>
                <th className="l">마지막 단계</th>
                <th>게임</th>
                <th>1위 횟수</th>
                <th className="wide">평균 순위</th>
                <th className="wide">게임당 킬 점수</th>
                <th>결승 순위</th>
              </tr>
            </thead>
            <tbody>
              {events.map(({ e, list, last }) => (
                <tr key={e.key}>
                  <td className="l pin">{e.name}</td>
                  <td className="l">{last}</td>
                  <td>{list.length}</td>
                  <td>{list.filter((g) => g.placement === 1).length}</td>
                  <td className="wide">{(list.reduce((a, g) => a + g.placement, 0) / list.length).toFixed(2)}</td>
                  <td className="wide">{(list.reduce((a, g) => a + g.killScore, 0) / list.length).toFixed(2)}</td>
                  <td>
                    {finalRank.has(e.key) ? (
                      <Link className={LINK} href={`${KEL_SCREENS.finals.path}?f=${e.key}`}>
                        {finalRank.get(e.key)}위
                      </Link>
                    ) : (
                      <span className="text-fg-3">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>

      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="roster">
        <h2 id="roster" className={H2}>
          선수 {players.length}명
        </h2>
        <KelScroll label="선수" className="mt-3">
          <table className="kel-table">
            <thead>
              <tr>
                <th className="l pin">선수</th>
                <th>게임</th>
                <th>KPR 평점</th>
                <th>게임당 킬</th>
                <th className="wide">가한 피해 비중</th>
                <th className="l wide">많이 고른 실험체</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => {
                const faces = p.characters.slice(0, 3).map(([c]) => <Char key={c} name={c} label="" />);
                return (
                  <tr key={p.name}>
                    <td className="l pin font-semibold">
                      <Link className={LINK} href={playerPath(p.name)}>
                        {p.name}
                      </Link>
                      <span className="narrow mt-1">
                        <span className="inline-flex gap-1">{faces}</span>
                      </span>
                    </td>
                    <td>{p.games}</td>
                    <td>{p.kpr.toFixed(3)}</td>
                    <td>{p.kills.toFixed(2)}</td>
                    <td className="wide">{pct(p.damageShare)}</td>
                    <td className="l wide">
                      <span className="inline-flex gap-1">{faces}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </KelScroll>
      </section>

      <div className="grid grid-cols-2 items-start gap-5 max-[860px]:grid-cols-1">
        <div className="grid gap-5">
          <section className="panel p-5 max-[760px]:p-4" aria-labelledby="chars">
            <h2 id="chars" className={H2}>
              실험체와 3인 조합
            </h2>
            <h3 className={`mt-3 ${SUB}`}>많이 고른 실험체</h3>
            <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 max-[420px]:grid-cols-1">
              {picks.map(([c, n]) => (
                <li key={c} className="flex items-center justify-between gap-3 text-[15px]">
                  <Char name={c} />
                  <span className="text-fg-3">{n}게임</span>
                </li>
              ))}
            </ul>
            <h3 className={`mt-5 border-t border-line-soft pt-4 ${SUB}`}>많이 쓴 3인 조합</h3>
            <ul className="@container mt-2 grid gap-2.5 text-[14px]">
              {combos.map((c) => (
                <li key={c.chars.join()} className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center gap-x-3 gap-y-1 @max-[440px]:grid-cols-3">
                  {c.chars.map((ch) => (
                    <Char key={ch} name={ch} />
                  ))}
                  <span className="text-right text-fg-3 @max-[440px]:col-span-3 @max-[440px]:text-left">
                    {c.n}게임, 평균 {c.avg.toFixed(1)}위
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-5 max-[760px]:p-4" aria-labelledby="best">
            <h2 id="best" className={H2}>
              팀 최고 기록
            </h2>
            <ul className="mt-3 grid gap-2 text-[14px]">
              {(
                [
                  ["팀 게임 점수", `${score(best)}점`, best],
                  ["팀이 기록한 킬", `${kills.kills}킬`, kills],
                ] as const
              ).map(([label, value, g]) => (
                <li key={label} className="grid grid-cols-[7.5rem_4rem_minmax(0,1fr)] items-center gap-3">
                  <span className="text-fg-3">{label}</span>
                  <b className="text-right tabular-nums">{value}</b>
                  <span className="text-right text-[13px] text-fg-3">{gameLabel(g)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="grid gap-5">
          <section className="panel p-5 max-[760px]:p-4" aria-labelledby="ops">
            <h2 id="ops" className={H2}>
              운영과 시작 지역
            </h2>
            {op && (
              <dl className="mt-3 grid grid-cols-2 gap-3 max-[420px]:gap-2">
                <Tile label="위클라인 처치 게임" value={`${op.wickline}게임`}>
                  {opRank((r) => r.wickline)}
                </Tile>
                <Tile label="평균 생존 시간" value={duration(op.time)}>
                  {opRank((r) => r.time)}
                </Tile>
                <Tile label="게임당 시야 점수" value={op.vision.toFixed(1)}>
                  {opRank((r) => r.vision)}
                </Tile>
                <Tile label="게임당 망원 카메라" value={`${op.camera.toFixed(1)}개`}>
                  {opRank((r) => r.camera)}
                </Tile>
              </dl>
            )}
            <h3 className={`mt-5 ${SUB}`}>많이 시작한 지역</h3>
            <ul className="mt-2 grid gap-1.5 text-[14px]">
              {areas.map(([a, s]) => (
                <li key={a} className="flex justify-between">
                  <span>{a}</span>
                  <span className="text-fg-3">{pct(s)}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel p-5 max-[760px]:p-4" aria-labelledby="kills">
            <h2 id="kills" className={H2}>
              처치 관계
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 max-[420px]:grid-cols-1">
              {(
                [
                  ["많이 처치한 팀", most((x) => x.out), "out"],
                  ["이 팀을 많이 처치한 팀", most((x) => x.in), "in"],
                ] as const
              ).map(([title, list, side]) => (
                <div key={title} className="min-w-0">
                  <h3 className={SUB}>{title}</h3>
                  <ul className="mt-2 grid gap-1.5 text-[14px]">
                    {list.map((x) => (
                      <li key={x.t.key} className="flex min-w-0 items-center gap-2">
                        <Logo team={x.t} size={22} label />
                        <Link className={`truncate font-semibold ${LINK}`} href={teamPath(x.t)}>
                          {x.t.name}
                        </Link>
                        <span className="ml-auto flex-none text-fg-3">{x[side]}번 처치</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </KelPage>
  );
}
