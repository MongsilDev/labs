import type { Metadata } from "next";
import Link from "next/link";
import Lines from "@/components/Lines";
import CreateForm from "@/er/components/CreateForm";
import OpenCode from "@/er/components/OpenCode";
import { computeGroup } from "@/er/lib/engine";
import { exampleView } from "@/er/lib/example";
import { avatarUrl, currentUser } from "@/er/server/auth";
import { myTournaments } from "@/er/server/tournament";
import Live from "@/next/Live";

export const metadata: Metadata = {
  title: "대회 점수",
  description: "이터널 리턴 커스텀 게임 결과 CSV로 커뮤니티 대회 순위, 감점, 체크포인트, 금지 실험체를 계산합니다.",
  icons: { icon: "/er/icon.svg", apple: "/er/apple-icon" },
  openGraph: { siteName: "Labs", type: "website", locale: "ko_KR", images: [{ url: "/er/opengraph-image", width: 1200, height: 630, alt: "Labs 이터널 리턴" }] },
};
export const dynamic = "force-dynamic";

// 1위 칸이 가장 진하고 아래로 갈수록 옅어짐
const heat = (p: number | null) => (p == null ? undefined : `color-mix(in srgb, var(--hot) ${Math.max(0, 60 - (p - 1) * 8)}%, transparent)`);

export default async function ScorePage({ searchParams }: { searchParams: Promise<{ create?: string; login?: string }> }) {
  const q = await searchParams;
  const me = await currentUser();
  const mine = me ? myTournaments(me) : [];
  const ex = exampleView();
  const g = ex.groups[0];
  const res = computeGroup({ mode: ex.mode, rules: ex.rules, plannedRounds: ex.plannedRounds, rounds: g.rounds, penalties: g.penalties, weather: g.weather, aliases: g.aliases, overrides: g.overrides });
  const rounds = Array.from({ length: res.played }, (_, i) => i + 1);
  return (
    <Live user={me ? { name: me.name, avatar: avatarUrl(me) } : null}>
      <h1 className="text-[26px] leading-tight font-bold tracking-[-0.5px]">대회 점수</h1>
      {q.login === "failed" && (
        <p className="mt-4 border border-down px-4 py-3" role="alert">
          <Lines text="디스코드 로그인을 마치지 못했습니다. 다시 시도해주세요." />
        </p>
      )}
      <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0">
          <div className="sec">
            <h2 className="sec-h">
              {ex.name}
              <Link className="more" href="/er/example/a">예시 대회 열기</Link>
            </h2>
            <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="tbl max-lg:min-w-[560px]">
                <thead>
                  <tr>
                    <th className="w-8">#</th>
                    <th className="l">팀</th>
                    {rounds.map((r) => <th key={r} className="!text-center">{r}R</th>)}
                    <th>처치</th>
                    <th className="pin-r" aria-sort="descending">총점</th>
                  </tr>
                </thead>
                <tbody>
                  {res.standings.map((s) => (
                    <tr key={s.key}>
                      <td className="text-ink-3">{s.rank}</td>
                      <td className="l font-semibold">{s.name}</td>
                      {s.rounds.map((r, i) => (
                        <td key={i} className="!text-center" style={{ background: heat(r?.placement ?? null) }}>
                          {r?.placement ?? "-"}
                        </td>
                      ))}
                      <td className="text-ink-2">{s.kills}</td>
                      <td className="pin-r text-[16px] font-bold">{s.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="sec mt-10 max-w-[480px] [&_section+section]:mt-8">
            <OpenCode mine={mine} />
          </div>
        </section>
        <aside className="grid content-start gap-8 max-lg:order-first">
          <section className="sec" aria-labelledby="new-h">
            <h2 id="new-h" className="sec-h mb-4">새 대회</h2>
            <CreateForm loggedIn={Boolean(me)} autoCreate={q.create === "1"} />
          </section>
        </aside>
      </div>
    </Live>
  );
}
