import Link from "next/link";
import { dateKo } from "@/er/lib/format";
import Shell from "@/next/Shell";
import Recent from "@/tarkov/components/players/Recent";
import SearchBox from "@/tarkov/components/players/SearchBox";
import { int } from "@/tarkov/lib/format";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "계정 조회" };

export default async function NextPlayers({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const indexed = Number(getMeta("indexed_at")) || null;
  const count = Number(getMeta("accounts")) || 0;
  return (
    <Shell here="players">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
        <section>
          <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">계정 조회</h1>
          <div className="mt-5">
            <SearchBox autoFocus initial={typeof q === "string" ? q.slice(0, 32) : undefined} />
          </div>
          <Recent />
        </section>
        <dl className="grid content-start gap-5 border-t-2 border-ink pt-4 lg:mt-[52px]">
          <div>
            <dt className="text-[12px] font-semibold text-ink-3">찾을 수 있는 계정</dt>
            <dd className="m-0 mt-1 text-[34px] leading-none font-black num">{indexed ? `${int(count)}개` : "준비 중"}</dd>
          </div>
          {indexed && (
            <div>
              <dt className="text-[12px] font-semibold text-ink-3">이름 목록 기준</dt>
              <dd className="m-0 mt-1 text-[15px] font-semibold num">{indexed ? dateKo(indexed) : "-"}</dd>
            </div>
          )}
          <Link className="link justify-self-start" href="/tarkov/criteria">판정 기준</Link>
        </dl>
      </div>
    </Shell>
  );
}
