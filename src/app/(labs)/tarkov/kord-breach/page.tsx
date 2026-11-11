import type { Metadata } from "next";
import Live from "@/next/Live";
import Simulator from "@/tarkov/components/kord/Simulator";
import achievements from "@/tarkov/data/achievements.json";
import { presets } from "@/tarkov/lib/kord";
import "@/app/tarkov/kord-breach/kord.css";

export const metadata: Metadata = {
  title: "KORD BREACH 특성 시뮬레이터",
  description: "Escape from Tarkov 시즌 1 KORD BREACH 특성 포인트 계산",
  icons: { icon: "/tarkov/icon.svg", apple: "/tarkov/apple-icon" },
  openGraph: { siteName: "Labs", type: "website", locale: "ko_KR", images: [{ url: "/tarkov/opengraph-image", width: 1200, height: 630, alt: "Labs Escape from Tarkov" }] },
};

export default function KordBreachPage() {
  return (
    <Live>
      <h1 className="mb-5 text-[26px] leading-tight font-bold tracking-[-0.5px]">KORD BREACH 특성 시뮬레이터</h1>
      <Simulator presets={presets(achievements)} />
    </Live>
  );
}
