import Image from "next/image";
import Link from "next/link";
import Shell from "@/next/Shell";
import MetaMap from "@/next/MetaMap";
import { spots } from "@/next/meta";
import CutMini from "@/er/components/cut/CutMini";
import { Logo } from "@/er/components/kel/Team";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { fmt } from "@/er/lib/format";
import { EVENT_NAME, TEAM } from "@/er/lib/kel";
import { getCut } from "@/er/server/cut";
import { kelData } from "@/er/server/kel";
import { scoreStages } from "@/er/server/kel-stats";
import { pickView, signed, type TierCombo } from "@/er/lib/tier";
import { getTier } from "@/er/server/tier";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면" };

const n = (v: number) => v.toLocaleString("ko-KR");
const GRADES = ["S", "A", "B", "C", "D"] as const;
const id = (c: TierCombo) => `${c.char}-${c.weapon}`;

export default async function NextHub() {
  const [cut, tier] = await Promise.all([getCut(), getTier()]);
  const picked = tier ? pickView(tier) : null;
  const view = picked?.combos.length ? picked : null;
  const combos = view ? [...view.combos].sort((a, b) => b.score - a.score) : [];
  // 같은 실험체의 S 등급 무기를 얼굴 하나 아래에 모음
  const faces = new Map<number, TierCombo[]>();
  for (const c of combos) if (c.grade === "S") faces.set(c.char, [...(faces.get(c.char) ?? []), c]);
  const { list, median } = view ? spots(view) : { list: [], median: 0 };
  // 지도의 네 끝에 있는 조합만 이름 후보로 넘기고, 겹치는 이름은 MetaMap이 뺌
  const byPick = [...combos].sort((a, b) => b.pick - a.pick);
  const label = new Set([...combos.slice(0, 3), ...combos.slice(-3), ...byPick.slice(0, 3), ...byPick.slice(-2)].map(id));
  const kel = kelData();
  const final = kel ? scoreStages(kel).at(-1) : undefined;
  const accounts = Number(getMeta("accounts")) || 0;
  return (
    <Shell>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-11 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="sec">
          <h2 className="sec-h">
            <Link href="/next/er/tier">실험체 티어</Link>
            {view && <small className="num">{view.label}, {n(view.rows)}판</small>}
            <Link className="more" href="/next/er/tier">전체 {combos.length}개</Link>
          </h2>
          {view ? (
            <>
              <ul className="mt-3 grid grid-cols-4 gap-x-2.5 gap-y-4 sm:grid-cols-6 xl:grid-cols-8">
                {[...faces.values()].map((ws) => (
                  <li key={ws[0].char} className="min-w-0 max-sm:nth-[n+9]:hidden">
                    <Link href={`/next/er/tier/${id(ws[0])}`} className="group block hover:no-underline">
                      <Image className="block aspect-square h-auto w-full rounded-[2px] bg-row object-cover group-hover:outline-2 group-hover:outline-ink" src={`/img/er/char/${ws[0].key}.v1.webp`} alt="" width={96} height={96} unoptimized />
                      <b className="mt-1.5 block truncate text-[14px]">{ws[0].name}</b>
                    </Link>
                    {ws.map((c) => (
                      <Link key={c.weapon} href={`/next/er/tier/${id(c)}`} className="flex justify-between gap-1 text-[12px] text-ink-3 hover:text-ink hover:no-underline">
                        <span className="truncate">{c.weaponName}</span>
                        <span className="font-semibold text-ink-2 num">{signed(c.score)}</span>
                      </Link>
                    ))}
                  </li>
                ))}
              </ul>
              <ul className="mt-4 flex gap-5 border-t border-rule pt-3 text-[13px] text-ink-2 num">
                {GRADES.map((g) => (
                  <li key={g} className="flex items-center gap-1.5">
                    <span className={`grade grade-${g}`}>{g}</span>
                    {combos.filter((c) => c.grade === g).length}개
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="py-3 text-ink-3">실험체 티어를 불러오지 못했습니다.</p>
          )}
        </section>

        <section className="sec">
          <h2 className="sec-h">
            <Link href="/next/er/meta">메타 지도</Link>
          </h2>
          {view && (
            <div className="mt-2">
              <MetaMap list={list} median={median} label={label} w={380} h={300} />
            </div>
          )}
        </section>

        <section className="sec">
          <h2 className="sec-h">
            <Link href="/next/er/cut">이터컷</Link>
            {cut && <small>{cut.season.name}</small>}
            <Link className="more" href="/next/er/cut">내 RP 진단</Link>
          </h2>
          {cut ? (
            <div className="mt-3 grid items-end gap-x-10 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
              <dl className="grid grid-cols-2 gap-x-8">
                {TIERS.map(({ key, name }) => {
                  const t = cut.tiers[key];
                  const end = t.forecast?.[t.forecast.length - 1];
                  return (
                    <div key={key}>
                      <dt className="text-[12px] font-semibold text-ink-3 num">{name} {n(t.place)}위</dt>
                      <dd className="m-0 mt-1.5 text-[38px] leading-none font-black tracking-[-1.2px] num sm:text-[44px]">
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
            <Link href="/next/er/overlay">티어 방송 화면</Link>
          </h2>
          <form action="/next/er/overlay" className="mt-3 flex gap-2" noValidate>
            <input className="field" name="n" placeholder="닉네임" aria-label="닉네임" autoComplete="off" spellCheck={false} maxLength={32} />
            <button className="btn primary flex-none">주소 만들기</button>
          </form>
        </section>

        <section className="sec">
          <h2 className="sec-h">
            <Link href="/next/er/kel">2026 KEL</Link>
            {final && <small>{EVENT_NAME[final.event]} {final.stage}</small>}
          </h2>
          {final ? (
            <ol className="mt-1">
              {final.state.rows.slice(0, 3).map((row, i) => {
                const t = TEAM.get(row.key)!;
                return (
                  <li key={row.key} className="border-b border-rule">
                    <Link href="/next/er/kel/finals" className="flex h-11 items-center gap-2.5 font-semibold hover:bg-row hover:no-underline">
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
          <h2 className="sec-h">
            <Link href="/next/tarkov/players">타르코프 계정 조회</Link>
            <small className="num">계정 {n(accounts)}개</small>
          </h2>
          <form action="/next/tarkov/players" className="mt-3 flex gap-2" noValidate>
            <input className="field" name="q" placeholder="닉네임이나 계정 번호" aria-label="닉네임이나 계정 번호" autoComplete="off" spellCheck={false} maxLength={32} />
            <button className="btn primary flex-none">조회</button>
          </form>
          <Link href="/next/tarkov/kord-breach" className="mt-3 flex h-11 items-center border-y border-rule font-semibold hover:bg-row hover:no-underline">
            KORD BREACH 특성 시뮬레이터
          </Link>
        </section>
      </div>
    </Shell>
  );
}
