import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import Header from "@/tarkov/components/Header";
import Simulator from "@/tarkov/components/kord/Simulator";
import achievements from "@/tarkov/data/achievements.json";
import { presets } from "@/tarkov/lib/kord";
import "./kord.css";

export const metadata: Metadata = {
  title: "KORD BREACH 특성 시뮬레이터",
  description: "Escape from Tarkov 시즌 1 KORD BREACH 특성 포인트 계산",
};

export default function KordBreachPage() {
  return (
    <>
      <Header crumb={{ href: "/tarkov/kord-breach", label: "KORD BREACH" }} />
      <main id="main" className="wrap">
        <h1 className="page-h1">KORD BREACH 특성 시뮬레이터</h1>
        <Simulator presets={presets(achievements)} />
      </main>
      <Footer />
    </>
  );
}
