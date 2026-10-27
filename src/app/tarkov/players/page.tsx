import Link from "next/link";
import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import Header from "@/tarkov/components/Header";
import Recent from "@/tarkov/components/players/Recent";
import SearchBox from "@/tarkov/components/players/SearchBox";
import { date, int } from "@/tarkov/lib/format";
import { getMeta } from "@/tarkov/server/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "계정 조회",
  description: "Escape from Tarkov 닉네임으로 시즌, PvP, PvE, 아레나 전적 조회",
};

export default async function Players({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const indexed = Number(getMeta("indexed_at")) || null;
  const count = Number(getMeta("accounts")) || 0;
  return (
    <>
      <Header crumb={{ href: "/tarkov/players", label: "계정 조회" }} />
      <main id="main" className="wrap slim">
        <h1 className="page-h1">계정 조회</h1>
        <SearchBox autoFocus initial={typeof q === "string" ? q.slice(0, 32) : undefined} />
        <p className="sub note">
          tarkov.dev에서 한 번 이상 조회된 계정만 찾을 수 있습니다.
          <br />
          {indexed ? `이름 목록에는 ${int(count)}명이 있고, ${date(indexed)} 기준입니다.` : "이름 목록을 준비하고 있습니다."}
          <br />
          <Link className="link" href="/tarkov/criteria">
            판정 기준
          </Link>
        </p>
        <Recent />
      </main>
      <Footer />
    </>
  );
}
