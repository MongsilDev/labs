import Link from "next/link";
import HeatCell from "@/er/components/kel/HeatCell";
import KelPage, { KelScroll, KelTabs, NO_DATA, pickTab } from "@/er/components/kel/KelPage";
import { Logo } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { characterName, pct } from "@/er/lib/format";
import { KEL_EVENTS, KEL_SCREENS, TEAM } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata, type Kel } from "@/er/server/kel";
import { SKILL_SLOTS } from "@/er/server/kel-dakgg";
import { characterBuilds, characterStats, seasonBuilds, type CharacterBuild, type CharacterStat, type PickRate, type Share } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("characters");

type View = "rate" | "build";

const VIEWS: [View, string][] = [
  ["rate", "등장률"],
  ["build", "빌드"],
];

type Sort = "picks" | "place" | "rise";

const AVG_NOTE = "평균 순위는 이 실험체를 고른 선수가 속한 팀의 순위를 평균한 값이고, 1위 비율은 그 팀이 1위를 차지한 비율입니다.";

const SORTS: [Sort, string][] = [
  ["picks", "등장률 순"],
  ["place", "평균 순위 순"],
  ["rise", "서킷 4 등장률 증가 순"],
];

const SORT: Record<Sort, (a: CharacterStat, b: CharacterStat) => number> = {
  picks: (a, b) => b.rate - a.rate,
  place: (a, b) => a.avgPlace - b.avgPlace,
  rise: (a, b) => b.byEvent.c4 - b.byEvent.c3 - (a.byEvent.c4 - a.byEvent.c3),
};

const buildPath = (key: string) => `${KEL_SCREENS.characters.path}?view=build&c=${encodeURIComponent(key)}`;
const place = (v: number) => `${v.toFixed(2)}위`;

function Bar({ s, sub }: { s: Share; sub?: string }) {
  return (
    <li className="py-1">
      <span className="flex justify-between gap-2 text-[14px]">
        <span className="min-w-0 truncate">{s.name}</span>
        <span className="text-fg-2 tabular-nums">{pct(s.share)}</span>
      </span>
      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-field">
        <span className="block h-full rounded-full" style={{ width: `${s.share * 100}%`, background: "var(--kel-1)" }} />
      </span>
      {sub && <span className="mt-0.5 block text-[12px] text-fg-3">{sub}</span>}
    </li>
  );
}

function Block({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-[13px] font-semibold text-fg-3">{title}</h3>
      {empty ? <p className="text-[14px] text-fg-3">기록 없음</p> : children}
    </div>
  );
}

function Card({ b }: { b: CharacterBuild }) {
  const order = b.order?.name.split(" ") ?? [];
  return (
    <section className="panel grid grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-7 p-6 max-[1080px]:grid-cols-1 max-[760px]:p-4" aria-labelledby="character">
      <div className="min-w-0">
        <h2 id="character" className="flex items-center gap-4 text-[32px] leading-tight font-extrabold tracking-[-0.5px] max-[760px]:text-[28px]">
          <Char name={b.key} label="" size={64} />
          {characterName(b.key)}
        </h2>
        <dl className="mt-5 grid grid-cols-3 gap-2.5">
          {[
            ["등장률", pct(b.rate), `${b.games}게임`],
            ["평균 순위", place(b.avgPlace)],
            ["1위 비율", pct(b.winRate), `${b.picks}번 중 ${b.wins}번`],
          ].map(([label, value, sub]) => (
            <div key={label} className="min-w-0 rounded-lg bg-field px-4 py-3.5 max-[420px]:px-3">
              <dt className="text-[13px] text-fg-3">{label}</dt>
              <dd className="mt-1 text-[22px] leading-tight font-extrabold max-[420px]:text-[19px]">{value}</dd>
              {sub && <dd className="mt-0.5 text-[13px] text-fg-3">{sub}</dd>}
            </div>
          ))}
        </dl>
        <h3 className="mt-5 text-[13px] font-semibold text-fg-3">많이 고른 선수</h3>
        <ul className="mt-2 grid gap-2">
          {b.players.map((p) => (
            <li key={p.name} className="flex items-center justify-between gap-3 text-[15px]">
              <span className="inline-flex min-w-0 items-center gap-2">
                <Logo team={TEAM.get(p.team)!} size={22} label />
                <span className="truncate">{p.name}</span>
              </span>
              <span className="text-fg-3">{p.count}게임</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-3 content-start gap-x-7 gap-y-6 max-[1080px]:grid-cols-2 max-[560px]:grid-cols-1">
        <Block title="무기" empty={!b.weapons.length}>
          <ul>
            {b.weapons.map((w) => (
              <Bar key={w.name} s={w} sub={b.weapons.length > 1 ? `${w.count}번, 평균 ${place(w.avgPlace)}` : undefined} />
            ))}
          </ul>
        </Block>
        <Block title="전술 스킬" empty={!b.tactical.length}>
          <ul>
            {b.tactical.map((s) => (
              <Bar key={s.name} s={s} />
            ))}
          </ul>
        </Block>
        <Block title="핵심 특성" empty={!b.traits.length}>
          <ul>
            {b.traits.map((s) => (
              <Bar key={s.name} s={s} />
            ))}
          </ul>
        </Block>
        <Block title="마지막 일격 스킬" empty={!b.lastHits.length}>
          <ul>
            {b.lastHits.map((s) => (
              <Bar key={s.name} s={s} sub={`${s.count}번`} />
            ))}
          </ul>
        </Block>
        <Block title="많이 고른 최종 장비" empty={!b.gear.length}>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-2 text-[14px]">
            {b.gear.map((g) => (
              <div key={g.slot} className="contents">
                <dt className="text-fg-3">{g.slot}</dt>
                <dd className="min-w-0 truncate">{g.name}</dd>
                <dd className="text-right text-fg-2 tabular-nums">{pct(g.share)}</dd>
              </div>
            ))}
          </dl>
        </Block>
        <Block title="1~6레벨 스킬 순서" empty={!b.order}>
          {b.order && (
            <>
              <ol className="flex flex-wrap gap-1.5" aria-label={b.order.name}>
                {order.map((s, i) => (
                  <li key={i} className="grid size-[34px] place-items-center rounded-lg bg-field font-extrabold">
                    {s}
                  </li>
                ))}
              </ol>
              <ul className="mt-2.5 text-[13px] leading-relaxed text-fg-3">
                {[...new Set(order)].filter((s) => b.skills[s as (typeof SKILL_SLOTS)[number]]).map((s) => (
                  <li key={s}>
                    {s} {b.skills[s as (typeof SKILL_SLOTS)[number]]}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-fg-3">고른 기록의 {pct(b.order.share)}</p>
            </>
          )}
        </Block>
      </div>
    </section>
  );
}

function RateTable({ title, rows, events }: { title: string; rows: PickRate[]; events: readonly (typeof KEL_EVENTS)[number][] }) {
  return (
    <section className="panel min-w-0 p-5 max-[760px]:p-4" aria-labelledby="tactical">
      <h2 id="tactical" className="text-[17px] font-extrabold">
        {title}
      </h2>
      <KelScroll label={title} className="mt-3">
        <table className="kel-table kel-heat">
          <thead>
            <tr>
              <th className="l pin">전술 스킬</th>
              <th className="narrow">시즌 전체</th>
              {events.map((e) => (
                <th key={e.key} className="text-center">
                  {e.name}
                </th>
              ))}
              <th className="wide">시즌 전체</th>
              <th>평균 순위</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td className="l pin">{r.name}</td>
                <td className="narrow font-bold">{pct(r.share)}</td>
                {events.map((e) => (
                  <HeatCell key={e.key} v={r.byEvent[e.key]}>
                    {pct(r.byEvent[e.key] ?? 0)}
                  </HeatCell>
                ))}
                <td className="wide font-bold">{pct(r.share)}</td>
                <td>{place(r.avgPlace)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </KelScroll>
    </section>
  );
}

function Build({ data, b }: { data: Kel; b: CharacterBuild }) {
  const builds = characterBuilds(data);
  const season = seasonBuilds(data);
  const events = KEL_EVENTS.filter((e) => season.tactical.some((t) => t.byEvent[e.key] !== null));
  const traits = season.traits.slice(0, 10);
  return (
    <>
      <Card b={b} />
      <section className="panel p-5 max-[760px]:p-4" aria-labelledby="character-list">
        <h2 id="character-list" className="text-[17px] font-extrabold">
          실험체 {builds.length}종
        </h2>
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {builds.map((x) => (
            <li key={x.key}>
              <Link
                href={buildPath(x.key)}
                aria-current={x.key === b.key ? "page" : undefined}
                aria-label={characterName(x.key)}
                className="group grid w-14 justify-items-center gap-0.5 no-underline"
              >
                <span className="grid size-10 place-items-center rounded-full border-2 border-transparent group-hover:border-line-strong group-aria-[current=page]:border-accent">
                  <Char name={x.key} label="" size={32} />
                </span>
                <span className="w-full truncate text-center text-[11px] text-fg-3 group-aria-[current=page]:font-bold group-aria-[current=page]:text-fg" aria-hidden="true">
                  {characterName(x.key)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)] items-start gap-5 max-[1280px]:grid-cols-1">
        <RateTable title="전술 스킬 대회별 선택률" rows={season.tactical} events={events} />
        <section className="panel min-w-0 p-5 max-[760px]:p-4" aria-labelledby="traits">
          <h2 id="traits" className="text-[17px] font-extrabold">
            핵심 특성 선택률
          </h2>
          <KelScroll label="핵심 특성 선택률" className="mt-3">
            <table className="kel-table w-full">
              <thead>
                <tr>
                  <th className="l">특성</th>
                  <th className="l">계열</th>
                  <th>선택률</th>
                  <th>평균 순위</th>
                </tr>
              </thead>
              <tbody>
                {traits.map((t) => (
                  <tr key={t.name}>
                    <td className="l">{t.name}</td>
                    <td className="l text-fg-3">{t.group}</td>
                    <td className="font-bold">{pct(t.share)}</td>
                    <td>{place(t.avgPlace)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </KelScroll>
        </section>
      </div>
    </>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<{ view?: string; sort?: string; c?: string }> }) {
  const { user, owner } = await kelGate("characters");
  const q = await searchParams;
  const view = pickTab(VIEWS, q.view);
  const sort = pickTab(SORTS, q.sort);
  const data = kelData();
  if (!data) return <KelPage user={user} owner={owner} screen="characters" missing={NO_DATA} />;
  const { total, eventGames, rows } = characterStats(data);
  const tabs = <KelTabs screen="characters" param="view" label="보기" items={VIEWS} current={view} />;

  if (view === "build") {
    const builds = characterBuilds(data);
    const b = builds.find((x) => x.key === q.c) ?? builds[0];
    if (!b) return <KelPage user={user} owner={owner} screen="characters" lead="dak.gg 경기 상세를 찾지 못했습니다.">{tabs}</KelPage>;
    const { records } = seasonBuilds(data);
    return (
      <KelPage
        user={user}
        owner={owner}
        screen="characters"
        notes={[
          `카드의 비율은 그 실험체를 고른 기록 가운데 경기 상세가 있는 ${b.records}개로 계산하고, 무기 칸의 장비는 그 무기를 장착한 기록만 집계합니다.`,
          `마지막 일격 스킬은 한 게임에서 선수마다 세 번까지 남는 사망 기록 가운데 첫 번째 기록만 사용하며, 이 실험체가 처치한 ${b.deaths}번을 기준으로 집계합니다.`,
          b.unnamed > 0 && `공식 이름을 찾지 못한 스킬로 처치한 ${b.unnamed}번은 스킬 이름을 dak.gg 원문 그대로 표시했습니다.`,
          `전술 스킬과 핵심 특성 선택률은 선수 기록 ${records.toLocaleString("ko-KR")}개 전체에서 계산했고, 대회별 칸은 그 대회의 선수 기록만으로 따로 구했습니다.`,
          AVG_NOTE,
        ]}
      >
        {tabs}
        <Build data={data} b={b} />
      </KelPage>
    );
  }

  const min = Math.ceil(total * 0.1);
  const shown = rows.filter((r) => r.games >= min).sort(SORT[sort]);
  const events = KEL_EVENTS.filter((e) => eventGames[e.key] > 0);

  return (
    <KelPage
      user={user}
      owner={owner}
      screen="characters"
      notes={[
        "칸의 숫자는 그 대회 게임 가운데 한 팀이라도 그 실험체를 고른 게임이 차지하는 비율입니다.",
        `2026 시즌에 등장한 ${rows.length}종 가운데 시즌 게임의 10%인 ${min}게임 이상 등장한 ${shown.length}종만 표시했습니다.`,
        AVG_NOTE,
      ]}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {tabs}
        <KelTabs screen="characters" param="sort" label="정렬" items={SORTS} current={sort} className="sort" />
      </div>
      <section className="panel p-5 max-[760px]:p-4">
        <KelScroll label="대회별 실험체 등장률">
          <table className="kel-table kel-heat">
            <thead>
              <tr>
                <th className="l pin">실험체</th>
                <th className="narrow">시즌 전체</th>
                {events.map((e) => (
                  <th key={e.key} className="text-center">
                    {e.name}
                    <span className="block font-normal">{eventGames[e.key]}게임</span>
                  </th>
                ))}
                <th className="wide">시즌 전체</th>
                <th>평균 순위</th>
                <th>1위 비율</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td className="l pin">
                    <Char name={r.key} />
                  </td>
                  <td className="narrow font-bold">{pct(r.rate, 0)}</td>
                  {events.map((e) => (
                    <HeatCell key={e.key} v={r.byEvent[e.key]}>
                      {pct(r.byEvent[e.key], 0)}
                    </HeatCell>
                  ))}
                  <td className="wide font-bold">{pct(r.rate, 0)}</td>
                  <td>{r.avgPlace.toFixed(2)}위</td>
                  <td>{pct(r.winRate, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </KelScroll>
      </section>
    </KelPage>
  );
}
