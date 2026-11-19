import SeasonPage, { seasonMetadata } from "@/tarkov/components/kord/SeasonPage";
import { seasonBySlug } from "@/tarkov/lib/kord";

const KORD_BREACH = seasonBySlug("kord-breach")!;

export const metadata = seasonMetadata(KORD_BREACH);

export default function KordBreachPage() {
  return <SeasonPage season={KORD_BREACH} />;
}
