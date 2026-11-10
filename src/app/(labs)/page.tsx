import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import { CutSection, KelSection, OverlaySection, TarkovSection, TierHead, TierMissing, TierRows } from "@/next/HubParts";
import { hubData } from "@/next/hub";

export const dynamic = "force-dynamic";

export default async function Hub() {
  const h = await hubData();
  return (
    <Live user={h.user}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2 lg:gap-x-16">
        {/* 헤더 경계선 바로 아래라 첫 줄 구역은 윗선을 그리지 않음 */}
        <section className="sec border-t-0! pt-0!">
          <TierHead h={h} />
          {h.view ? <TierRows list={h.combos.slice(0, 5)} /> : <TierMissing />}
        </section>
        <CutSection h={h} className="lg:border-t-0! lg:pt-0!" body="mt-3 grid items-end gap-x-10 gap-y-2 sm:max-lg:grid-cols-[auto_minmax(0,1fr)]" />
      </div>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-x-12 xl:grid-cols-4">
        <KelSection h={h} />
        <HubScore mine={h.mine} preview={false} />
        <OverlaySection />
        <TarkovSection h={h} />
      </div>
    </Live>
  );
}
