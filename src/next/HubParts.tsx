import Image from "next/image";
import Link from "next/link";
import CutMini from "@/er/components/cut/CutMini";
import { Logo } from "@/er/components/kel/Team";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { fmt } from "@/er/lib/format";
import { EVENT_NAME, TEAM } from "@/er/lib/kel";
import { comboPath, signed, type TierCombo } from "@/er/lib/tier";
import HubSearch from "@/tarkov/components/players/HubSearch";
import RowLinks from "./RowLinks";
import Weapon from "./Weapon";
import type { Hub } from "./hub";

export const n = (v: number) => v.toLocaleString("ko-KR");
export const face = (c: TierCombo) => `/img/er/char/${c.key}.v1.webp`;

export function TierHead({ h, more = true }: { h: Hub; more?: boolean }) {
  return (
    <h2 className="sec-h">
      <Link href="/er/tier">실험체 티어</Link>
      {h.view && <small className="num">{h.view.label}, {n(h.view.rows)}판</small>}
      {more && <Link className="more" href="/er/tier">전체 {h.combos.length}개</Link>}
    </h2>
  );
}

export function TierRows({ list, start = 0 }: { list: TierCombo[]; start?: number }) {
  return (
    <ol className="mt-1">
      {list.map((c, i) => (
        <li key={`${c.char}-${c.weapon}`} className="border-b border-rule">
          <Link href={comboPath(c)} className="flex h-11 items-center gap-2.5 font-semibold hover:bg-row hover:no-underline">
            <span className="w-4 font-normal text-ink-3 num">{start + i + 1}</span>
            <Image className="size-7 flex-none rounded-[2px] bg-row object-cover" src={face(c)} alt="" width={28} height={28} unoptimized />
            <Weapon code={c.weapon} name={c.weaponName} />
            <span className="-ml-1 truncate">{c.name}</span>
            <b className="ml-auto font-black num">{signed(c.score)}</b>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function TierMissing() {
  return <p className="py-3 text-ink-3">실험체 티어를 불러오지 못했습니다.</p>;
}

/** 이터니티와 데미갓 컷. big은 숫자를 키운 브랜드형 시안용 */
export function CutBody({ cut, big = false }: { cut: NonNullable<Hub["cut"]>; big?: boolean }) {
  return (
    <>
      <dl className={`grid grid-cols-2 ${big ? "gap-x-6 sm:gap-x-16" : "gap-x-8"}`}>
        {TIERS.map(({ key, name, color }) => {
          const t = cut.tiers[key];
          const end = t.forecast?.[t.forecast.length - 1];
          return (
            <div key={key}>
              <dt className="flex items-center gap-1.5 text-[12px] font-semibold text-ink-3 num">
                <span className="h-3 w-1" style={{ background: color }} aria-hidden="true" />
                {name} {n(t.place)}위
              </dt>
              <dd className={`m-0 mt-1.5 leading-none font-bold num ${big ? "text-[48px] tracking-[-1.5px] sm:text-[88px] sm:tracking-[-3px] lg:text-[120px] lg:tracking-[-5px]" : "text-[38px] tracking-[-1px] sm:text-[44px]"}`}>
                {t.estimated ? <span className={`mr-1 font-bold tracking-normal text-ink-3 ${big ? "text-[18px] sm:text-[28px] lg:text-[36px]" : "text-[18px]"}`}>약</span> : null}
                {t.cut != null ? rp(t.cut) : "-"}
              </dd>
              {end && <p className={`mt-2 text-ink-2 num ${big ? "text-[13px] sm:text-[17px]" : "text-[13px]"}`}>종료 예상 {tens(end[1])}</p>}
            </div>
          );
        })}
      </dl>
      <CutMini data={cut} />
    </>
  );
}

export function CutSection({ h, className = "", body = "mt-3 grid items-end gap-x-10 gap-y-2", big = false }: { h: Hub; className?: string; body?: string; big?: boolean }) {
  return (
    <section className={`sec ${className}`}>
      <h2 className="sec-h">
        <Link href="/er/cut">이터컷</Link>
        {h.cut && <small>{h.cut.season.name}</small>}
        <Link className="more" href="/er/cut">내 RP 진단</Link>
      </h2>
      {h.cut ? (
        <div className={body}>
          <CutBody cut={h.cut} big={big} />
        </div>
      ) : (
        <p className="py-3 text-ink-3">이터컷을 불러오지 못했습니다.</p>
      )}
    </section>
  );
}

export function KelRows({ h }: { h: Hub }) {
  if (!h.final) return <p className="py-3 text-ink-3">KEL 기록을 불러오지 못했습니다.</p>;
  return (
    <ol className="mt-1">
      {h.final.state.rows.slice(0, 3).map((row, i) => {
        const t = TEAM.get(row.key)!;
        return (
          <li key={row.key} className="border-b border-rule">
            <Link href="/er/kel/finals" className="flex h-11 items-center gap-2.5 font-semibold hover:bg-row hover:no-underline">
              <span className="w-4 font-normal text-ink-3 num">{i + 1}</span>
              <Logo team={t} size={24} className="ring-1 ring-rule-2" />
              {t.name}
              <b className="ml-auto font-black num">{fmt(row.total)}</b>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export function KelHead({ h }: { h: Hub }) {
  return (
    <h2 className="sec-h">
      <Link href="/er/kel">2026 KEL</Link>
      {h.final && <small>{EVENT_NAME[h.final.event]} {h.final.stage}</small>}
    </h2>
  );
}

export function KelSection({ h, className = "" }: { h: Hub; className?: string }) {
  return (
    <section className={`sec ${className}`}>
      <KelHead h={h} />
      <KelRows h={h} />
    </section>
  );
}

export function OverlaySection({ className = "" }: { className?: string }) {
  return (
    <section className={`sec ${className}`}>
      <h2 className="sec-h">오버레이</h2>
      <RowLinks items={[{ href: "/er/overlay", label: "랭크 오버레이" }]} />
    </section>
  );
}

export function TarkovHead({ h }: { h: Hub }) {
  return (
    <h2 className="sec-h">
      <Link href="/tarkov/players">타르코프 계정 조회</Link>
      <small className="num">계정 {n(h.accounts)}개</small>
    </h2>
  );
}

export function TarkovSection({ h, className = "" }: { h: Hub; className?: string }) {
  return (
    <section className={`sec ${className}`}>
      <TarkovHead h={h} />
      <div className="mt-3">
        <HubSearch />
      </div>
      <RowLinks items={[{ href: "/tarkov/kord-breach", label: "KORD BREACH 특성 시뮬레이터" }]} />
    </section>
  );
}
