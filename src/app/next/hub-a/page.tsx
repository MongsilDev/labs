import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import HubStage from "@/next/HubStage";
import { CutSection, KelSection, OverlaySection, TarkovSection, TierHead, TierMissing } from "@/next/HubParts";
import { hubData } from "@/next/hub";
import { halfArt } from "@/er/lib/tier";
import "@/next/hub.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "첫 화면 A" };

export default async function HubA() {
  const h = await hubData();
  return (
    <Live user={h.user}>
      <section className="sec hub-in border-t-0! pt-0!">
        <TierHead h={h} />
        {h.view ? <HubStage items={h.combos.slice(0, 5).map((c) => ({ c, art: halfArt(c.key) }))} /> : <TierMissing />}
      </section>

      <div className="hub-in mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 md:grid-cols-2 md:gap-x-12 lg:grid-cols-3" style={{ ["--d" as string]: 2 }}>
        <div className="grid content-start gap-10">
          <CutSection h={h} />
          <OverlaySection />
        </div>
        <HubScore mine={h.mine} className="self-start" />
        <div className="grid content-start gap-10 md:col-span-2 md:grid-cols-2 md:gap-x-12 lg:col-span-1 lg:grid-cols-1">
          <KelSection h={h} />
          <TarkovSection h={h} />
        </div>
      </div>
    </Live>
  );
}
