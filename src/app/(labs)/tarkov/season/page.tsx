import SeasonPage, { seasonMetadata } from "@/tarkov/components/kord/SeasonPage";
import { LATEST } from "@/tarkov/lib/kord";

export const metadata = seasonMetadata(LATEST);

export default function CurrentSeasonPage() {
  return <SeasonPage season={LATEST} />;
}
