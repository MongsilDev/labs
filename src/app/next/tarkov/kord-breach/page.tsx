import Shell from "@/next/Shell";
import Simulator from "@/tarkov/components/kord/Simulator";
import achievements from "@/tarkov/data/achievements.json";
import { presets } from "@/tarkov/lib/kord";
import "@/app/tarkov/kord-breach/kord.css";

export const metadata = { title: "KORD BREACH 특성 시뮬레이터" };

export default function NextKord() {
  return (
    <Shell here="kord">
      <h1 className="mb-5 text-[26px] leading-tight font-black tracking-[-0.5px]">KORD BREACH 특성 시뮬레이터</h1>
      <Simulator presets={presets(achievements)} />
    </Shell>
  );
}
