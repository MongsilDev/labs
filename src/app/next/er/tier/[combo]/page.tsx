import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/next/Shell";
import { pickView, signed } from "@/er/lib/tier";
import { getTier } from "@/er/server/tier";

export const dynamic = "force-dynamic";

// 상세 내용은 ertier 창이 main에서 만드는 중이라 여기서는 위쪽 메뉴와 제목 틀만 맞춤
export default async function NextCombo({ params, searchParams }: { params: Promise<{ combo: string }>; searchParams: Promise<{ v?: string }> }) {
  const [{ combo }, { v }] = await Promise.all([params, searchParams]);
  const data = await getTier();
  const view = data ? pickView(data, v) : null;
  const c = view?.combos.find((x) => `${x.char}-${x.weapon}` === combo);
  if (!data || !view || !c) notFound();
  return (
    <Shell here="tier">
      <p className="text-[13px] text-ink-3">
        <Link href={`/next/er/tier${v ? `?v=${encodeURIComponent(v)}` : ""}`}>실험체 티어</Link>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3 border-b-2 border-ink pb-4">
        <Image className="size-16 rounded-[2px] object-cover" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={64} height={64} unoptimized />
        <div>
          <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">
            <span className="text-ink-3">{c.weaponName}</span> {c.name}
          </h1>
          <p className="mt-1 text-[13px] text-ink-3 num">{view.label}, {c.n.toLocaleString("ko-KR")}판</p>
        </div>
        <dl className="grid grid-cols-[repeat(4,auto)] justify-between gap-x-5 gap-y-1 num max-sm:w-full sm:ml-auto sm:gap-x-8">
          {[
            ["등급", <span key="g" className={`grade grade-${c.grade}`}>{c.grade}</span>],
            ["점수", signed(c.score)],
            ["TOP3", `${c.top3.toFixed(1)}%`],
            ["픽률", `${c.pick.toFixed(2)}%`],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-[12px] font-semibold text-ink-3">{k}</dt>
              <dd className="m-0 mt-1 text-[22px] leading-none font-black">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Shell>
  );
}
