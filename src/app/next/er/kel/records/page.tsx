import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import Char from "@/er/components/t/Char";
import { Logo, PlayerName } from "@/er/components/kel/Team";
import { TEAM } from "@/er/lib/kel";
import { placementPoints } from "@/er/lib/kel-calc";
import { kelData, type KelRow, type TeamGame } from "@/er/server/kel";
import { gameLabel, records, scoped, scopesOf, type StyleScope } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "한 게임 기록" };

type Rec = ReturnType<typeof records>;
const int = (v: number) => Math.round(v).toLocaleString("ko-KR");
const SOLO: { label: string; row: (x: Rec) => KelRow | null; value: (r: KelRow) => string }[] = [
  { label: "킬", row: (x) => x.kills, value: (r) => `${r.kills}` },
  { label: "가한 피해", row: (x) => x.damage[0]?.r ?? null, value: (r) => int(r.damage) },
  { label: "받은 피해", row: (x) => x.taken, value: (r) => int(r.taken) },
  { label: "7위 이하 팀이 가한 피해", row: (x) => x.lowTeamDamage, value: (r) => int(r.damage) },
  { label: "군중제어 시간", row: (x) => x.cc, value: (r) => `${r.dak!.cc.toFixed(1)}초` },
  { label: "팀원 회복", row: (x) => x.heal, value: (r) => int(r.dak!.heal) },
  { label: "망원 카메라 설치", row: (x) => x.camera, value: (r) => `${r.dak!.camera}` },
  { label: "시야 점수", row: (x) => x.vision, value: (r) => `${r.dak!.vision}` },
];

function TeamCell({ g }: { g: TeamGame }) {
  const t = TEAM.get(g.team)!;
  return (
    <span className="flex items-center gap-2 font-semibold">
      <Logo team={t} size={22} className="ring-1 ring-rule-2" />
      {t.name}
    </span>
  );
}

export default async function NextKelRecords({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const q = await searchParams;
  const data = kelData();
  if (!data) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.<br />잠시 뒤 다시 열어주세요.</p></Shell>;
  const scopes = scopesOf(data);
  const scope = (scopes.find(([k]) => k === q.s) ?? scopes[0])[0] as StyleScope;
  const rec = records(scoped(data, scope));
  const solo = SOLO.flatMap((t) => {
    const r = t.row(rec);
    return r ? [{ ...t, r }] : [];
  });
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">한 게임 기록</h1>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="records" />
        <div className="grid min-w-0 content-start gap-10">
          <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0" aria-label="범위">
            {scopes.map(([k, name]) => (
              <Link key={k} href={k === "season" ? "/next/er/kel/records" : `/next/er/kel/records?s=${k}`} aria-current={k === scope ? "page" : undefined} className="shrink-0 border border-rule px-2.5 py-1 text-[13px] font-semibold text-ink-2 hover:no-underline aria-[current=page]:border-ink aria-[current=page]:text-ink">
                {name}
              </Link>
            ))}
          </nav>
          <section className="sec min-w-0">
            <h2 className="sec-h">선수 최고 기록</h2>
            <div className="scroll-fade -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l">기록</th>
                    <th>값</th>
                    <th className="l">선수</th>
                    <th className="l hidden sm:table-cell">실험체</th>
                    <th className="l hidden md:table-cell">경기</th>
                  </tr>
                </thead>
                <tbody>
                  {solo.map(({ label, r, value }) => (
                    <tr key={label}>
                      <td className="l text-ink-2">{label}</td>
                      <td className="text-[15px] font-black">{value(r)}</td>
                      <td className="l"><PlayerName name={r.player} team={TEAM.get(r.team)} logoClass="ring-1 ring-rule-2" /></td>
                      <td className="l hidden sm:table-cell"><Char name={r.character} size={22} /></td>
                      <td className="l hidden text-ink-3 md:table-cell">{gameLabel(r)}, {r.placement}위</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grid gap-10 xl:grid-cols-2">
            <section className="sec min-w-0">
              <h2 className="sec-h">팀 최고 기록</h2>
              <table className="tbl">
                <tbody>
                  <tr>
                    <td className="l text-ink-2">팀 킬</td>
                    <td className="text-[15px] font-black">{rec.teamKills.kills}</td>
                    <td className="l"><TeamCell g={rec.teamKills} /><span className="mt-0.5 block text-[12px] text-ink-3">{gameLabel(rec.teamKills)}, {rec.teamKills.placement}위</span></td>
                  </tr>
                  {rec.teamScore.games.map((g) => (
                    <tr key={`${g.gameId}-${g.team}`}>
                      <td className="l text-ink-2">게임 점수</td>
                      <td className="text-[15px] font-black">{int(rec.teamScore.value)}</td>
                      <td className="l"><TeamCell g={g} /><span className="mt-0.5 block text-[12px] text-ink-3">{gameLabel(g)}, 순위 점수 {placementPoints(g.placement)}, 킬 점수 {int(g.killScore)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="sec min-w-0">
              <h2 className="sec-h">가한 피해 상위 {rec.damage.length}개</h2>
              <table className="tbl">
                <tbody>
                  {rec.damage.map(({ r, rank }) => (
                    <tr key={`${r.gameId}-${r.player}`}>
                      <td className="l w-8 font-bold">{rank}</td>
                      <td className="l"><PlayerName name={r.player} team={TEAM.get(r.team)} logoClass="ring-1 ring-rule-2" /><span className="mt-0.5 block text-[12px] text-ink-3">{gameLabel(r)}</span></td>
                      <td className="l hidden sm:table-cell"><Char name={r.character} size={22} /></td>
                      <td className="font-bold">{int(r.damage)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </div>
      </div>
    </Shell>
  );
}
