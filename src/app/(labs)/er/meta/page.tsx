import Image from "next/image";
import Live from "@/next/Live";
import Filters from "@/next/Filters";
import MetaMap from "@/next/MetaMap";
import { spots, type Spot } from "@/next/meta";
import { pickView, signed } from "@/er/lib/tier";
import { avatarUrl, currentUser } from "@/er/server/auth";
import { getTier } from "@/er/server/tier";

export const dynamic = "force-dynamic";
export const metadata = { title: "메타 지도" };

function Rows({ title, rows, empty }: { title: string; rows: Spot[]; empty: string }) {
  return (
    <section className="sec">
      <h2 className="sec-h">
        {title}
        <small className="num">{rows.length}개</small>
      </h2>
      {rows.length ? (
        <table className="tbl mt-1 table-fixed">
          <thead>
            <tr>
              <th className="l">실험체</th>
              <th className="w-14">점수</th>
              <th className="w-[68px]">픽률</th>
              <th className="w-16">판</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={`${c.char}-${c.weapon}`}>
                <td className="l">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`grade grade-${c.grade}`}>{c.grade}</span>
                    <Image className="portrait" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
                    <span className="min-w-0 truncate"><span className="text-ink-3">{c.weaponName}</span> <span className="font-semibold">{c.name}</span></span>
                  </span>
                </td>
                <td className="font-bold">{signed(c.score)}</td>
                <td>{c.pick.toFixed(2)}%</td>
                <td className="text-ink-3">{c.n.toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="py-3 text-ink-3">{empty}</p>
      )}
    </section>
  );
}

export default async function MetaPage({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  const me = await currentUser();
  const user = me ? { name: me.name, avatar: avatarUrl(me) } : null;
  const data = await getTier();
  const view = data ? pickView(data, v) : null;
  if (!data || !view) return <Live user={user}><p className="text-ink-3">집계가 아직 없습니다.</p></Live>;
  const { list, median } = view.combos.length ? spots(view) : { list: [], median: 0 };
  const strong = list.filter((c) => c.sure && c.popular).sort((a, b) => b.score - a.score);
  const hidden = list.filter((c) => c.sure && !c.popular).sort((a, b) => b.score - a.score);
  const trap = list.filter((c) => c.weak && c.popular).sort((a, b) => a.score - b.score);
  const label = new Set([...hidden, ...trap].map((c) => `${c.char}-${c.weapon}`));
  const at = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(data.updatedAt);
  return (
    <Live user={user}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">메타 지도</h1>
        <p className="text-[13px] text-ink-3 num">
          {data.band.server} 상위 1,000명이 참가한 경기 {view.games.toLocaleString("ko-KR")}개, {at} 갱신
        </p>
      </div>
      <Filters groups={[{ name: "기간", items: data.views.map((x) => ({ href: `/er/meta?v=${x.id}`, label: x.label, on: x.id === view.id })) }]} />
      {!view.combos.length ? (
        <p className="mt-5 text-ink-3">이 기간은 집계가 아직 없습니다.</p>
      ) : (
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_400px]">
        <figure className="m-0">
          <div className="hidden lg:block">
            <MetaMap list={list} median={median} label={label} h={800} />
          </div>
          <div className="lg:hidden">
            <MetaMap list={list} median={median} label={label} w={358} h={440} fs={11} />
          </div>
        </figure>
        <div className="grid content-start gap-6">
          <Rows title="적게 쓰지만 강함" rows={hidden} empty="90% 범위가 0보다 높은 조합이 없습니다." />
          <Rows title="많이 쓰고 강함" rows={strong} empty="90% 범위가 0보다 높은 조합이 없습니다." />
          <Rows title="많이 쓰지만 약함" rows={trap} empty="90% 범위가 0보다 낮은 조합이 없습니다." />
        </div>
      </div>
      )}
    </Live>
  );
}
