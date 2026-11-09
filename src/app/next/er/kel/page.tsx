import Char from "@/er/components/t/Char";
import { Logo } from "@/er/components/kel/Team";
import Link from "next/link";
import Shell from "@/next/Shell";
import KelNav from "@/next/KelNav";
import { KEL_TEAMS, TEAM } from "@/er/lib/kel";
import { kelData, kelSummary } from "@/er/server/kel";
import { characterStats, kelChampion, playerStats } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "2026 KEL" };

// 1위가 가장 진하고 13위가 가장 옅은 칸
const heat = (place: number) => `color-mix(in srgb, var(--hot) ${Math.max(0, 70 - (place - 1) * 6)}%, transparent)`;

export default async function NextKel() {
  const data = kelData();
  if (!data) return <Shell here="kel"><p className="text-ink-3" role="status">KEL 기록을 불러오지 못했습니다.</p></Shell>;
  const sum = kelSummary(data);
  const champ = kelChampion(data);
  const avg = (t: (typeof KEL_TEAMS)[number]) => t.circuits.reduce((s, x) => s + x, 0) / t.circuits.length;
  const teams = [...KEL_TEAMS].sort((a, b) => avg(a) - avg(b));
  const players = playerStats(data).filter((p) => p.games >= 30).sort((a, b) => b.kpr - a.kpr).slice(0, 8);
  const chars = characterStats(data).rows.sort((a, b) => b.games - a.games).slice(0, 8);
  return (
    <Shell here="kel">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">2026 KEL</h1>
        <p className="text-[13px] text-ink-3 num">
          {sum.games.toLocaleString("ko-KR")}게임, {sum.first}~{sum.last}
          {champ ? `, 우승 ${TEAM.get(champ)?.name}` : ""}
        </p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <KelNav here="home" />
        <div className="grid content-start gap-10 xl:grid-cols-2">
          <section className="sec xl:col-span-2">
            <h2 className="sec-h">서킷 순위</h2>
            <table className="tbl mt-1 lg:!w-auto">
              <thead>
                <tr>
                  <th className="l lg:w-[240px]">팀</th>
                  {[1, 2, 3, 4].map((i) => (
                    <th key={i} className="!text-center lg:w-[84px]">서킷 {i}</th>
                  ))}
                  <th className="lg:w-[96px]"><span className="text-ink underline decoration-hot decoration-2 underline-offset-4">평균 순위</span></th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.key}>
                    <td className="l">
                      <span className="flex items-center gap-2 font-semibold">
                        <Logo team={t} size={24} className="ring-1 ring-rule-2" />
                        {t.name}
                        {t.key === champ && <span className="text-[12px] font-bold text-hot">우승</span>}
                      </span>
                    </td>
                    {t.circuits.map((p, i) => (
                      <td key={i} className="!text-center font-bold" style={{ background: heat(p) }}>{p}</td>
                    ))}
                    <td className="font-bold">{avg(t).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="sec">
            <h2 className="sec-h">
              처치가 많은 선수
              <Link className="more" href="/next/er/kel/players">선수 전체</Link>
            </h2>
            <table className="tbl mt-1">
              <thead>
                <tr><th className="l">선수</th><th>게임당 처치</th><th>게임</th></tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.name}>
                    <td className="l"><span className="font-semibold">{p.name}</span> <span className="text-ink-3">{TEAM.get(p.team)?.short ?? p.team}</span></td>
                    <td className="font-bold">{p.kpr.toFixed(2)}</td>
                    <td className="text-ink-3">{p.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="sec">
            <h2 className="sec-h">
              많이 쓴 실험체
              <Link className="more" href="/er/kel/characters">실험체 전체</Link>
            </h2>
            <table className="tbl mt-1">
              <thead>
                <tr><th className="l">실험체</th><th>게임</th><th>평균 순위</th><th>1위 비율</th></tr>
              </thead>
              <tbody>
                {chars.map((c) => (
                  <tr key={c.key}>
                    <td className="l">
                      <span className="font-semibold"><Char name={c.key} size={24} /></span>
                    </td>
                    <td>{c.games}</td>
                    <td>{c.avgPlace.toFixed(2)}</td>
                    <td>{Math.round(c.winRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </Shell>
  );
}
