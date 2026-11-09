import Image from "next/image";
import Link from "next/link";
import Shell from "@/next/Shell";
import { spots } from "@/next/meta";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { getCut } from "@/er/server/cut";
import { kelData } from "@/er/server/kel";
import { characterStats, kelChampion } from "@/er/server/kel-stats";
import { TEAM } from "@/er/lib/kel";
import { pickView, signed } from "@/er/lib/tier";
import { getTier } from "@/er/server/tier";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면" };

const n = (v: number) => v.toLocaleString("ko-KR");

export default async function NextHub() {
  const [cut, tier] = await Promise.all([getCut(), getTier()]);
  const view = tier ? pickView(tier) : null;
  const top = view ? [...view.combos].sort((a, b) => b.score - a.score).slice(0, 12) : [];
  const map = view ? spots(view).list : [];
  const hidden = map.filter((c) => c.sure && !c.popular).sort((a, b) => b.score - a.score).slice(0, 3);
  const trap = map.filter((c) => c.weak && c.popular).sort((a, b) => b.pick - a.pick).slice(0, 3);
  const names = new Map(view?.combos.map((c) => [c.key, c.name]) ?? []);
  const kel = kelData();
  const champ = kelChampion(kel);
  const chars = kel ? characterStats(kel).rows.slice().sort((a, b) => b.games - a.games).slice(0, 6) : [];
  const accounts = Number(getMeta("accounts")) || 0;
  return (
    <Shell>
      <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
        <section className="sec lg:col-span-7">
          <h2 className="sec-h">
            <Link href="/er/tier">실험체 티어</Link>
            {view && <small className="num">{view.label}, {n(view.rows)}판</small>}
            <Link className="more" href="/er/tier">전체 {view?.combos.length ?? 0}개</Link>
          </h2>
          <table className="tbl mt-1">
            <thead>
              <tr>
                <th className="l">실험체</th>
                <th>점수</th>
                <th>TOP3</th>
                <th>픽률</th>
                <th className="hidden sm:table-cell">판</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c) => (
                <tr key={`${c.char}-${c.weapon}`}>
                  <td className="l">
                    <span className="flex items-center gap-2">
                      <span className={`grade grade-${c.grade}`}>{c.grade}</span>
                      <Image className="portrait" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-ink-3">{c.weaponName}</span>
                    </span>
                  </td>
                  <td className="font-bold">{signed(c.score)}</td>
                  <td>{c.top3.toFixed(1)}%</td>
                  <td>{c.pick.toFixed(2)}%</td>
                  <td className="hidden text-ink-3 sm:table-cell">{n(c.n)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="grid content-start gap-10 lg:col-span-5">
          <section className="sec">
            <h2 className="sec-h">
              <Link href="/er/cut">이터컷</Link>
              {cut && <small>{cut.season.name}</small>}
            </h2>
            {cut ? (
              <dl className="mt-2 grid grid-cols-2 gap-6">
                {TIERS.map(({ key, name }) => {
                  const t = cut.tiers[key];
                  const end = t.forecast?.[t.forecast.length - 1];
                  return (
                    <div key={key}>
                      <dt className="text-[12px] font-semibold text-ink-3 num">{name} {n(t.place)}위</dt>
                      <dd className="m-0 mt-0.5 text-[32px] leading-none font-black tracking-[-0.8px] num">
                        {t.estimated ? <span className="mr-1 text-[16px] font-bold text-ink-3">약</span> : null}
                        {t.cut != null ? rp(t.cut) : "-"}
                      </dd>
                      {end && <p className="mt-1.5 text-[12px] text-ink-3 num">종료 예상 <b className="text-ink">{tens(end[1])}</b></p>}
                    </div>
                  );
                })}
              </dl>
            ) : (
              <p className="py-3 text-ink-3">이터컷을 불러오지 못했습니다.</p>
            )}
          </section>

          {view && (
            <section className="sec">
              <h2 className="sec-h">
                <Link href="/next/er/meta">메타 지도</Link>
                <Link className="more" href="/next/er/meta">점수와 픽률</Link>
              </h2>
              <div className="mt-1 grid grid-cols-2 gap-6">
                {([["적게 쓰지만 강함", hidden], ["많이 쓰지만 약함", trap]] as const).map(([name, rows]) => (
                  <div key={name}>
                    <h3 className="border-b border-rule-2 py-1.5 text-[12px] font-semibold text-ink-3">{name}</h3>
                    <ul>
                      {rows.map((c) => (
                        <li key={`${c.char}-${c.weapon}`} className="flex h-9 items-center gap-2 border-b border-rule">
                          <Image className="portrait" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
                          <span className="min-w-0 truncate font-semibold">{c.name} <span className="font-normal text-ink-3">{c.weaponName}</span></span>
                          <span className="ml-auto font-bold num">{signed(c.score)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="sec lg:col-span-7">
          <h2 className="sec-h">
            <Link href="/er/kel">2026 KEL</Link>
            {champ && <small>우승 {TEAM.get(champ)?.name}</small>}
            <Link className="more" href="/er/kel/characters">실험체 전체</Link>
          </h2>
          <table className="tbl mt-1">
            <thead>
              <tr>
                <th className="l">실험체</th>
                <th>판</th>
                <th>평균 순위</th>
                <th>1위 비율</th>
              </tr>
            </thead>
            <tbody>
              {chars.map((c) => (
                <tr key={c.key}>
                  <td className="l">
                    <span className="flex items-center gap-2">
                      <Image className="portrait" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
                      <span className="font-semibold">{names.get(c.key) ?? c.key}</span>
                    </span>
                  </td>
                  <td>{n(c.games)}</td>
                  <td>{c.avgPlace.toFixed(2)}</td>
                  <td>{Math.round(c.winRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="sec lg:col-span-5">
          <h2 className="sec-h">타르코프</h2>
          <ul className="mt-1">
            <li className="flex items-baseline border-b border-rule py-2.5">
              <Link href="/tarkov/players" className="font-semibold">계정 조회</Link>
              <span className="ml-auto text-[13px] text-ink-3 num">찾을 수 있는 계정 {n(accounts)}개</span>
            </li>
            <li className="flex items-baseline border-b border-rule py-2.5">
              <Link href="/tarkov/kord-breach" className="font-semibold">KORD BREACH 특성 시뮬레이터</Link>
            </li>
          </ul>
        </section>
      </div>
    </Shell>
  );
}
