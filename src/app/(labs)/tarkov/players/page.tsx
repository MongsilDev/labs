import type { Metadata } from "next";
import Link from "next/link";
import { dateKo } from "@/er/lib/format";
import Live from "@/next/Live";
import Recent from "@/tarkov/components/players/Recent";
import SearchBox from "@/tarkov/components/players/SearchBox";
import { int } from "@/tarkov/lib/format";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 조회",
  description: "Escape from Tarkov 닉네임으로 시즌, PvP, PvE, 아레나 전적 조회",
  icons: { icon: "/tarkov/icon.svg", apple: "/tarkov/apple-icon" },
  openGraph: { siteName: "Labs", type: "website", locale: "ko_KR", images: [{ url: "/tarkov/opengraph-image", width: 1200, height: 630, alt: "Labs Escape from Tarkov" }] },
};

export default async function Players({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const indexed = Number(getMeta("indexed_at")) || null;
  const count = Number(getMeta("accounts")) || 0;
  return (
    <Live>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
        <section>
          <h1 className="text-[26px] leading-tight font-bold tracking-[-0.5px]">계정 조회</h1>
          <div className="mt-5">
            <SearchBox autoFocus initial={typeof q === "string" ? q.slice(0, 32) : undefined} />
          </div>
          <Recent />
        </section>
        <dl className="grid content-start gap-5 border-t-2 border-ink pt-4 lg:mt-[52px]">
          <div>
            <dt className="text-[12px] font-semibold text-ink-3">찾을 수 있는 계정</dt>
            <dd className="num m-0 mt-1 text-[34px] leading-none font-bold">{indexed ? `${int(count)}개` : "준비 중"}</dd>
            <dd className="m-0 mt-2 text-[13px] text-ink-2">tarkov.dev에서 한 번 이상 조회된 계정만 찾을 수 있습니다.</dd>
          </div>
          {indexed && (
            <div>
              <dt className="text-[12px] font-semibold text-ink-3">이름 목록 기준</dt>
              <dd className="num m-0 mt-1 text-[15px] font-semibold">{dateKo(indexed)}</dd>
            </div>
          )}
          <Link className="link justify-self-start" href="/tarkov/criteria">판정 기준</Link>
        </dl>
      </div>
    </Live>
  );
}
