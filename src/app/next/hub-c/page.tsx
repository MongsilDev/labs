import Image from "next/image";
import Link from "next/link";
import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import { CutSection, face, KelHead, n, OverlaySection, TierHead, TierMissing, TierRows } from "@/next/HubParts";
import RowLinks from "@/next/RowLinks";
import { hubData } from "@/next/hub";
import { Logo } from "@/er/components/kel/Team";
import { fmt } from "@/er/lib/format";
import { TEAM } from "@/er/lib/kel";
import { comboPath, signed } from "@/er/lib/tier";
import HubSearch from "@/tarkov/components/players/HubSearch";
import "@/next/hub.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 C" };

export default async function HubC() {
  const h = await hubData();
  const top = h.combos[0];
  const kel = h.final?.state.rows ?? [];
  const lead = kel[0] ? TEAM.get(kel[0].key) : undefined;
  return (
    <Live user={h.user}>
      <div className="hub-c">
        <div className="hub-in">
          <CutSection h={h} big className="border-t-0! pt-0!" body="mt-6 grid gap-y-4" />
        </div>

        <div className="hub-bento hub-in mt-12 grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-6" style={{ ["--d" as string]: 1 }}>
          <section className="sec md:col-span-6 lg:col-span-3">
            <TierHead h={h} />
            {h.view && top ? (
              <>
                <Link href={comboPath(top)} className="mt-4 flex items-end gap-4 hover:no-underline">
                  <Image className="size-14 flex-none rounded-[2px] bg-row object-cover" src={face(top)} alt="" width={56} height={56} unoptimized />
                  <span className="grid min-w-0 gap-1">
                    <span className="text-[13px] font-semibold text-ink-2">{top.weaponName}</span>
                    <b className="truncate text-[22px] leading-none font-bold">{top.name}</b>
                  </span>
                  <b className="ml-auto text-[48px] leading-none font-bold tracking-[-1.5px] num sm:text-[72px] sm:tracking-[-3px]">{signed(top.score)}</b>
                </Link>
                <div className="mt-3 border-t border-rule">
                  <TierRows list={h.combos.slice(1, 5)} start={1} />
                </div>
              </>
            ) : (
              <TierMissing />
            )}
          </section>
          <HubScore mine={h.mine} className="md:col-span-6 lg:col-span-3" />
          <section className="sec md:col-span-3 lg:col-span-2">
            <KelHead h={h} />
            {lead && kel[0] ? (
              <>
                <Link href="/er/kel/finals" className="mt-4 flex items-end gap-3 hover:no-underline">
                  <Logo team={lead} size={40} className="ring-1 ring-rule-2" />
                  <b className="truncate text-[20px] font-bold">{lead.name}</b>
                  <b className="ml-auto text-[48px] leading-none font-bold tracking-[-1.5px] num sm:text-[56px]">{fmt(kel[0].total)}</b>
                </Link>
                <ol className="mt-3 border-t border-rule">
                  {kel.slice(1, 3).map((row, i) => {
                    const t = TEAM.get(row.key)!;
                    return (
                      <li key={row.key} className="border-b border-rule">
                        <Link href="/er/kel/finals" className="flex h-11 items-center gap-2.5 font-semibold hover:bg-row hover:no-underline">
                          <span className="w-4 font-normal text-ink-3 num">{i + 2}</span>
                          <Logo team={t} size={24} className="ring-1 ring-rule-2" />
                          {t.name}
                          <b className="ml-auto font-black num">{fmt(row.total)}</b>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <p className="py-3 text-ink-3">KEL 기록을 불러오지 못했습니다.</p>
            )}
          </section>
          <OverlaySection className="md:col-span-3 lg:col-span-2" />
          <section className="sec md:col-span-6 lg:col-span-2">
            <h2 className="sec-h">
              <Link href="/tarkov/players">타르코프 계정 조회</Link>
            </h2>
            <p className="mt-4 flex items-baseline gap-2">
              <b className="text-[48px] leading-none font-bold tracking-[-1.5px] num sm:text-[56px]">{n(h.accounts)}</b>
              <span className="text-[13px] font-semibold text-ink-3">계정</span>
            </p>
            <div className="mt-4">
              <HubSearch />
            </div>
            <RowLinks items={[{ href: "/tarkov/kord-breach", label: "KORD BREACH 특성 시뮬레이터" }]} />
          </section>
        </div>
      </div>
    </Live>
  );
}
