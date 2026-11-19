import { notFound } from "next/navigation";
import SeasonPage, { seasonMetadata } from "@/tarkov/components/kord/SeasonPage";
import { SEASONS, seasonBySlug } from "@/tarkov/lib/kord";

// 시즌마다 /tarkov/<시즌>에 남김. 가장 최근 시즌도 열리되 대표 주소는 /tarkov/season
export const dynamicParams = false;
export const generateStaticParams = () => SEASONS.map((s) => ({ slug: s.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const s = seasonBySlug((await params).slug);
  return s ? seasonMetadata(s) : {};
}

export default async function PastSeasonPage({ params }: Props) {
  const s = seasonBySlug((await params).slug);
  if (!s) notFound();
  return <SeasonPage season={s} />;
}
