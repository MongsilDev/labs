import Image from "next/image";
import Link from "next/link";
import Live from "@/next/Live";
import RowLinks from "@/next/RowLinks";
import Weapon from "@/next/Weapon";
import CutMini from "@/er/components/cut/CutMini";
import { Logo } from "@/er/components/kel/Team";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { fmt } from "@/er/lib/format";
import { EVENT_NAME, TEAM } from "@/er/lib/kel";
import { getCut } from "@/er/server/cut";
import { kelData } from "@/er/server/kel";
import { scoreStages } from "@/er/server/kel-stats";
import { comboPath, pickView, signed } from "@/er/lib/tier";
import { getTier } from "@/er/server/tier";
import HubSearch from "@/tarkov/components/players/HubSearch";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";

const n = (v: number) => v.toLocaleString("ko-KR");

export default async function Hub() {
  const [cut, tier] = await Promise.all([getCut(), getTier()]);
  const picked = tier ? pickView(tier) : null;
  const view = picked?.combos.length ? picked : null;
  const combos = view ? [...view.combos].sort((a, b) => b.score - a.score) : [];
  const kel = kelData();
  const final = kel ? scoreStages(kel).at(-1) : undefined;
  const accounts = Number(getMeta("accounts")) || 0;
  return (
    <Live>
      {/* 헤더 경계선 바로 아래라 첫 구역은 윗선을 그리지 않음 */}
      <section className="sec border-t-0! pt-0!">
        <h2 className="sec-h">
          <Link href="/er/tier">실험체 티어</Link>
          {view && <small className="num">{view.label}, {n(view.rows)}판</small>}
          <Link className="more" href="/er/tier">전체 {combos.length}개</Link>
        </h2>
        {view ? (
          // 열 수 x 두 줄만 남겨 어느 폭에서도 마지막 줄이 꽉 참
          <ul className="mt-3 grid grid-cols-4 gap-x-2.5 gap-y-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 max-sm:[&>li:nth-child(n+9)]:hidden sm:max-lg:[&>li:nth-child(n+13)]:hidden lg:max-xl:[&>li:nth-child(n+17)]:hidden">
            {combos.slice(0, 20).map((c) => (
              <li key={`${c.char}-${c.weapon}`} className="min-w-0">
                <Link href={comboPath(c)} className="group block hover:no-underline">
                  <Image className="block aspect-square h-auto w-full rounded-[2px] bg-row object-cover group-hover:outline-2 group-hover:outline-hot" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={96} height={96} unoptimized />
                  <b className="mt-1.5 flex min-w-0 items-center gap-1 text-[14px]">
                    <Weapon code={c.weapon} name={c.weaponName} />
                    <span className="truncate">{c.name}</span>
                  </b>
                  <span className="text-[13px] font-semibold text-ink-2 num">{signed(c.score)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-3 text-ink-3">실험체 티어를 불러오지 못했습니다.</p>
        )}
      </section>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2 lg:gap-x-16">
        <section className="sec">
          <h2 className="sec-h">
            <Link href="/er/cut">이터컷</Link>
            {cut && <small>{cut.season.name}</small>}
            <Link className="more" href="/er/cut">내 RP 진단</Link>
          </h2>
          {cut ? (
            <div className="mt-3 grid items-end gap-x-10 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
              <dl className="grid grid-cols-2 gap-x-8">
                {TIERS.map(({ key, name, color }) => {
                  const t = cut.tiers[key];
                  const end = t.forecast?.[t.forecast.length - 1];
                  return (
                    <div key={key}>
                      <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3 num">
                        <span className="h-3 w-1" style={{ background: color }} aria-hidden="true" />
                        {name} {n(t.place)}위
                      </dt>
                      <dd className="m-0 mt-1.5 text-[38px] leading-none font-bold tracking-[-1px] num sm:text-[44px]">
                        {t.estimated ? <span className="mr-1 text-[18px] font-bold tracking-normal text-ink-3">약</span> : null}
                        {t.cut != null ? rp(t.cut) : "-"}
                      </dd>
                      {end && <p className="mt-2 text-[13px] text-ink-2 num">종료 예상 {tens(end[1])}</p>}
                    </div>
                  );
                })}
              </dl>
              <CutMini data={cut} />
            </div>
          ) : (
            <p className="py-3 text-ink-3">이터컷을 불러오지 못했습니다.</p>
          )}
        </section>

        <section className="sec">
          <h2 className="sec-h">
            <Link href="/er/kel">2026 KEL</Link>
            {final && <small>{EVENT_NAME[final.event]} {final.stage}</small>}
          </h2>
          {final ? (
            <ol className="mt-1">
              {final.state.rows.slice(0, 3).map((row, i) => {
                const t = TEAM.get(row.key)!;
                return (
                  <li key={row.key} className="border-b border-rule">
                    <Link href="/er/kel/finals" className="flex h-11 items-center gap-2.5 font-semibold hover:bg-row hover:no-underline">
                      <span className="w-3.5 font-normal text-ink-3 num">{i + 1}</span>
                      <Logo team={t} size={24} className="ring-1 ring-rule-2" />
                      {t.name}
                      <b className="ml-auto font-black num">{fmt(row.total)}</b>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="py-3 text-ink-3">KEL 기록을 불러오지 못했습니다.</p>
          )}
        </section>

        <section className="sec">
          <h2 className="sec-h">오버레이</h2>
          <RowLinks items={[{ href: "/er/overlay", label: "랭크 오버레이" }, { href: "/er/score", label: "대회 오버레이" }]} />
        </section>

        <section className="sec">
          <h2 className="sec-h">
            <Link href="/tarkov/players">타르코프 계정 조회</Link>
            <small className="num">계정 {n(accounts)}개</small>
          </h2>
          <div className="mt-3">
            <HubSearch />
          </div>
          <RowLinks items={[{ href: "/tarkov/kord-breach", label: "KORD BREACH 특성 시뮬레이터" }]} />
        </section>
      </div>
    </Live>
  );
}
