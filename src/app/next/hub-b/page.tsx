import Image from "next/image";
import Link from "next/link";
import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import { CutSection, face, KelSection, n, OverlaySection, TarkovSection, TierHead, TierMissing, TierRows } from "@/next/HubParts";
import { hubData } from "@/next/hub";
import { comboPath, signed, type TierMoved } from "@/er/lib/tier";
import "@/next/hub.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 B" };

function Moved({ title, list, start }: { title: string; list: TierMoved[]; start: number }) {
  return (
    <div className="min-w-0">
      <h3 className="mt-4 text-[13px] font-semibold text-ink-3 num">{title} {list.length}</h3>
      <ol className="mt-1 max-sm:[&>li:nth-child(n+4)]:hidden">
        {list.slice(0, 5).map(({ c, o }, i) => (
          <li key={`${c.char}-${c.weapon}`} className="hub-in border-b border-rule" style={{ ["--d" as string]: start + i }}>
            <Link href={comboPath(c)} className="flex h-14 items-center gap-3 font-semibold hover:bg-row hover:no-underline">
              <Image className="size-9 flex-none rounded-[2px] bg-row object-cover" src={face(c)} alt="" width={36} height={36} unoptimized />
              {/* 같은 실험체가 무기만 달리 함께 오르기도 해서 무기 이름을 글자로 씀 */}
              <span className="min-w-0 truncate">
                <span className="font-normal text-ink-2">{c.weaponName}</span> {c.name}
              </span>
              <span className="ml-auto flex-none text-[13px] font-normal text-ink-3 num">
                {signed(o.score)} → {signed(c.score)}
              </span>
              <b className="w-14 flex-none text-right text-[20px] font-black num">{signed(c.score - o.score)}</b>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default async function HubB() {
  const h = await hubData();
  const up = h.moved.filter((m) => m.c.score > m.o.score);
  const down = h.moved.filter((m) => m.c.score < m.o.score);
  return (
    <Live user={h.user}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-x-16">
        {/* 지난 패치와 비교할 수 없는 기간(새 패치 첫날, 시즌 사이)에는 점수 순 상위 10개로 대신함 */}
        {h.prev && h.moved.length > 0 ? (
          <section className="sec border-t-0! pt-0!">
            <h2 className="sec-h">
              <Link href="/er/tier">{h.view!.patch} 패치에서 점수가 크게 바뀐 실험체</Link>
              <small className="num max-sm:hidden">{n(h.view!.rows)}판</small>
            </h2>
            <div className="grid gap-x-12 md:grid-cols-2">
              <Moved title="강해진 실험체" list={up} start={0} />
              <Moved title="약해진 실험체" list={down} start={5} />
            </div>
          </section>
        ) : (
          <section className="sec border-t-0! pt-0!">
            <TierHead h={h} />
            {h.view ? (
              <div className="grid gap-x-12 md:grid-cols-2">
                <TierRows list={h.combos.slice(0, 5)} />
                <TierRows list={h.combos.slice(5, 10)} start={5} />
              </div>
            ) : (
              <TierMissing />
            )}
          </section>
        )}
        <CutSection h={h} className="lg:border-t-0! lg:pt-0!" body="mt-3 grid items-end gap-x-10 gap-y-2 sm:max-lg:grid-cols-[auto_minmax(0,1fr)]" />
      </div>

      <div className={`mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-x-12 ${h.prev && h.moved.length > 0 ? "lg:grid-cols-3" : ""}`}>
        <div className="grid content-start gap-10">
          {h.prev && h.moved.length > 0 && (
            <section className="sec">
              <TierHead h={h} />
              {h.view ? <TierRows list={h.combos.slice(0, 5)} /> : <TierMissing />}
            </section>
          )}
          <OverlaySection />
        </div>
        <HubScore mine={h.mine} className="self-start" />
        <div className="grid content-start gap-10">
          <KelSection h={h} />
          <TarkovSection h={h} />
        </div>
      </div>
    </Live>
  );
}
