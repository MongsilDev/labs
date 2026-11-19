import type { Metadata } from "next";
import Live from "@/next/Live";
import Simulator from "@/tarkov/components/kord/Simulator";
import achievements from "@/tarkov/data/achievements.json";
import { SEASONS, presets, seasonPath, seasonTitle, type Season } from "@/tarkov/lib/kord";
import "@/app/tarkov/kord-breach/kord.css";

export const seasonMetadata = (s: Season): Metadata => ({
  title: `${seasonTitle(s)} 특성 시뮬레이터`,
  description: `Escape from Tarkov ${seasonTitle(s)} 시즌 특성 포인트 계산`,
  alternates: { canonical: seasonPath(s) },
  icons: { icon: "/tarkov/icon.svg", apple: "/tarkov/apple-icon" },
  openGraph: { siteName: "Labs", type: "website", locale: "ko_KR", images: [{ url: "/tarkov/opengraph-image", width: 1200, height: 630, alt: "Labs Escape from Tarkov" }] },
});

const paths = Object.fromEntries(SEASONS.map((s) => [s.slug, seasonPath(s)]));

export default function SeasonPage({ season }: { season: Season }) {
  return (
    <Live>
      <h1 className="mb-5 text-[26px] leading-tight font-bold tracking-[-0.5px]">{seasonTitle(season)} 특성 시뮬레이터</h1>
      <Simulator season={season} presets={presets(season, achievements)} paths={paths} />
    </Live>
  );
}
