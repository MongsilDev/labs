import Image from "next/image";
import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import ExampleBoard from "@/er/components/ExampleBoard";
import ThemeToggle from "@/er/components/ThemeToggle";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { getCut } from "@/er/server/cut";
import CutMini from "@/er/components/cut/CutMini";
import HubSearch from "@/tarkov/components/players/HubSearch";
import { exampleView } from "@/er/lib/example";
import Highlights from "@/er/components/kel/Highlights";
import { kelData } from "@/er/server/kel";
import { daysUntil, kelHighlights } from "@/er/server/kel-stats";
import { date, int } from "@/tarkov/lib/format";
import { PERSONAL } from "@/tarkov/lib/kord";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";

function Title({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className="group text-[22px] leading-snug font-extrabold tracking-[-0.3px] no-underline" href={href}>
      {children}
      <svg className="ml-1 inline-block size-5 align-[-3px] text-fg-3 transition-transform group-hover:translate-x-0.5 group-hover:text-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

type Stat = { label: string; value: React.ReactNode; color?: string };

function Stats({ items, className = "" }: { items: Stat[]; className?: string }) {
  return (
    <dl className={`mt-auto flex flex-wrap gap-x-8 gap-y-3 border-t border-line-soft pt-4 ${className}`}>
      {items.map((s) => (
        <div key={s.label} className="grid gap-0.5">
          <dt className="flex items-center gap-1.5 text-[12px] text-fg-3">
            {s.color && <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden="true" />}
            {s.label}
          </dt>
          <dd className="text-[20px] leading-tight font-extrabold tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// statsTop이면 760 이상에서 기록 줄을 제목 줄 오른쪽에 둠
function Tool({ game, icon, href, name, desc, children, stats, statsTop = false, className = "" }: {
  game: string;
  icon: string;
  href: string;
  name: string;
  desc: string;
  children?: React.ReactNode;
  stats?: Stat[];
  statsTop?: boolean;
  className?: string;
}) {
  const head = (
    <>
      <span className="mb-1.5 flex items-center gap-2 text-[13px] text-fg-3">
        <Image className="size-6 rounded-md" src={`/img/game/${icon}.webp`} alt="" width={24} height={24} unoptimized />
        {game}
      </span>
      <Title href={href}>{name}</Title>
      <p className="mt-1 text-[14px] text-fg-2">{desc}</p>
    </>
  );
  return (
    <section className={`panel flex flex-col p-6 max-[760px]:p-5 ${statsTop ? "min-[760px]:grid min-[760px]:grid-cols-[minmax(0,1fr)_auto] min-[760px]:gap-x-8" : ""} ${className}`} aria-label={name}>
      {statsTop ? <div className="flex min-w-0 flex-col">{head}</div> : head}
      {children && <div className={`${stats ? "mt-5 mb-5" : "mt-5"} ${statsTop ? "min-[760px]:col-span-2 min-[760px]:mb-0" : ""}`}>{children}</div>}
      {stats && <Stats items={stats} className={statsTop ? "min-[760px]:col-start-2 min-[760px]:row-start-1 min-[760px]:mt-0 min-[760px]:self-center min-[760px]:border-t-0 min-[760px]:pt-0" : ""} />}
    </section>
  );
}

// 남은 날은 서울 날짜로 서버에서 세고, 지난 날짜는 날짜만 보임
function Day({ date, text }: { date: string; text: string }) {
  const left = daysUntil(date);
  return (
    <>
      {text}
      {left >= 0 && <span className="ml-1.5 text-[13px] font-bold text-fg-3">{left ? `D-${left}` : "오늘"}</span>}
    </>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export default async function Hub() {
  const cut = await getCut();
  const indexed = Number(getMeta("indexed_at")) || null;
  const plus = PERSONAL.filter((p) => (p.points ?? 0) < 0);
  const minus = PERSONAL.filter((p) => (p.points ?? 0) > 0);
  // 포인트를 가장 많이 쓰는 긍정 특성과 가장 많이 얻는 부정 특성 둘씩
  const picks = [...[...plus].sort((a, b) => a.points! - b.points!).slice(0, 2), ...[...minus].sort((a, b) => b.points! - a.points!).slice(0, 2)];
  const kel = kelHighlights(kelData());
  return (
    <>
      <SiteHeader>
        <ThemeToggle />
      </SiteHeader>
      <main id="main" className="wrap">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-4 pb-6 max-[760px]:pt-1 max-[760px]:pb-5">
          <h1 className="text-[30px] leading-none font-extrabold tracking-[-0.6px]">Labs</h1>
          <p className="text-[15px] text-fg-3">게임 도구 모음</p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          <Tool
            game="이터널 리턴"
            icon="er"
            href="/er/kel"
            name="KEL 기록"
            desc="2026 KEL 서킷 순위, 결승 라운드별 점수, 선수와 실험체 기록"
            className="col-span-2 max-[760px]:col-span-1"
            statsTop
            stats={[
              { label: "준결승", value: <Day date="2026-11-07" text="11월 7일" /> },
              { label: "결승", value: <Day date="2026-11-08" text="11월 8일" /> },
            ]}
          >
            {kel && <Highlights data={kel} />}
          </Tool>

          <Tool
            game="이터널 리턴"
            icon="er"
            href="/er/score"
            name="점수 계산"
            desc="결과 CSV로 대회 순위, 감점, 체크포인트, 금지 실험체 계산"
            stats={[
              {
                label: "예시 대회",
                value: (
                  <Link className="link p-0 text-[20px] font-extrabold text-fg" href="/er/example/a">
                    {exampleView().name}
                  </Link>
                ),
              },
            ]}
          >
            <ExampleBoard rows={3} bare />
          </Tool>

          <Tool
            game="이터널 리턴"
            icon="er"
            href="/er/cut"
            name="이터컷 예측"
            className="cut"
            desc="휴면 강등을 반영한 아시아1 컷과 시즌 종료 예상"
            stats={
              cut
                ? TIERS.map(({ key, name, color }) => ({
                    label: `${name} 컷 위 휴면`,
                    value: `${rp(cut.tiers[key].decay.reduce((n, [, c]) => n + c, 0) + cut.tiers[key].decayStay)}명`,
                    color,
                  }))
                : []
            }
          >
            {cut ? (
              <div>
                <ul className="grid">
                  {TIERS.map(({ key, name, color }) => {
                    const tier = cut.tiers[key];
                    const end = tier.forecast?.[tier.forecast.length - 1];
                    return (
                      <li key={key} className="flex items-baseline gap-3 border-t border-line-soft py-2 first:border-t-0 first:pt-0">
                        <span className="flex items-center gap-1.5 text-[14px] font-bold">
                          <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                          {name}
                        </span>
                        <span className="ml-auto text-[14px] font-extrabold tabular-nums">
                          {tier.estimated ? "약 " : ""}
                          {tier.cut != null ? rp(tier.cut) : "-"}
                        </span>
                        {end && (
                          <span className="w-[96px] text-right text-[13px] text-fg-3 tabular-nums">
                            종료 <b className="font-extrabold" style={{ color }}>{tens(end[1])}</b>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <CutMini data={cut} />
              </div>
            ) : (
              <p className="text-[13px] text-fg-3">
                지금은 컷 정보를 가져올 수 없습니다.
                <br />
                잠시 뒤 다시 열어주세요.
              </p>
            )}
          </Tool>

          <Tool
            game="Escape from Tarkov"
            icon="eft"
            href="/tarkov/players"
            name="계정 조회"
            desc="시즌, PvP, PvE, 아레나 전적과 판정 배지"
            stats={[{ label: "찾을 수 있는 계정", value: int(Number(getMeta("accounts")) || 0) }]}
          >
            <HubSearch />
            <p className="mt-3 text-[13px] text-fg-3">
              tarkov.dev에서 한 번 이상 조회된 계정만 찾을 수 있습니다.
              <br />
              {indexed && (
                <>
                  이름 목록은 {date(indexed)} 기준입니다.
                  <br />
                </>
              )}
              <Link className="link" href="/tarkov/criteria">
                판정 기준
              </Link>
            </p>
          </Tool>

          <Tool
            game="Escape from Tarkov"
            icon="eft"
            href="/tarkov/kord-breach"
            name="KORD BREACH 특성 시뮬레이터"
            desc="시즌 1"
          >
            <p className="mb-2 text-[13px] text-fg-3">포인트가 가장 크게 바뀌는 특성</p>
            <ul className="grid">
              {picks.map((p) => (
                <li key={p.id} className="flex items-center gap-3 border-t border-line-soft py-2 first:border-t-0 first:pt-0">
                  <span className="min-w-0 truncate text-[14px] font-bold">{p.name}</span>
                  <span className="ml-auto text-[14px] font-extrabold tabular-nums text-fg-2">{signed(p.points!)}</span>
                </li>
              ))}
            </ul>
          </Tool>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
