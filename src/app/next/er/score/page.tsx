import Link from "next/link";
import Shell from "@/next/Shell";
import CreateForm from "@/er/components/CreateForm";
import OpenCode from "@/er/components/OpenCode";
import { computeGroup } from "@/er/lib/engine";
import { exampleView } from "@/er/lib/example";
import { currentUser } from "@/er/server/auth";
import { myTournaments } from "@/er/server/tournament";

export const dynamic = "force-dynamic";
export const metadata = { title: "대회 점수" };

// 1위 칸이 가장 진하고 아래로 갈수록 옅어짐
const heat = (p: number | null) => (p == null ? undefined : `color-mix(in srgb, var(--hot) ${Math.max(0, 60 - (p - 1) * 8)}%, transparent)`);

export default async function NextScore() {
  const user = await currentUser();
  const mine = user ? myTournaments(user) : [];
  const ex = exampleView();
  const g = ex.groups[0];
  const res = computeGroup({ mode: ex.mode, rules: ex.rules, plannedRounds: ex.plannedRounds, rounds: g.rounds, penalties: g.penalties, weather: g.weather, aliases: g.aliases, overrides: g.overrides });
  const rounds = Array.from({ length: res.played }, (_, i) => i + 1);
  return (
    <Shell here="score">
      <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">대회 점수</h1>
      <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="sec">
            <h2 className="sec-h">
              {ex.name}
              <Link className="more" href="/er/example/a">예시 대회 열기</Link>
            </h2>
            <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="tbl min-w-[560px]">
                <thead>
                  <tr>
                    <th className="l w-8">#</th>
                    <th className="l">팀</th>
                    {rounds.map((r) => <th key={r} className="!text-center">R{r}</th>)}
                    <th>처치</th>
                    <th>총점</th>
                  </tr>
                </thead>
                <tbody>
                  {res.standings.map((s) => (
                    <tr key={s.key}>
                      <td className="l text-ink-3">{s.rank}</td>
                      <td className="l font-semibold">{s.name}</td>
                      {s.rounds.map((r, i) => (
                        <td key={i} className="!text-center" style={{ background: heat(r?.placement ?? null) }}>
                          {r?.placement ?? "-"}
                        </td>
                      ))}
                      <td className="text-ink-2">{s.kills}</td>
                      <td className="text-[16px] font-black">{s.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        <aside className="order-first grid content-start gap-8 lg:order-none lg:border-l lg:border-rule lg:pl-10">
          <section aria-labelledby="new-h">
            <h2 id="new-h" className="mb-4 text-[18px] font-black">새 대회</h2>
            <CreateForm loggedIn={Boolean(user)} autoCreate={false} />
          </section>
          <OpenCode mine={mine} />
        </aside>
      </div>
    </Shell>
  );
}
