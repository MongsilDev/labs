"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Account, { type AccountUser } from "./Account";
import ThemeToggle from "./ThemeToggle";
import "./site.css";

type Item = { href: string; label: string; also?: string[] };
type Sect = { name: string; items: Item[] };

const ER: Sect[] = [
  {
    name: "실험체",
    items: [
      { href: "/er/tier", label: "실험체 티어" },
      { href: "/er/meta", label: "메타 지도" },
      { href: "/er/late", label: "초반과 막판" },
    ],
  },
  {
    name: "랭크",
    items: [
      { href: "/er/cut", label: "이터컷" },
      { href: "/er/rp", label: "RP 손익" },
      { href: "/er/overlay", label: "오버레이" },
    ],
  },
  {
    name: "대회",
    items: [
      { href: "/er/kel", label: "KEL 기록" },
      { href: "/er/score", label: "대회 점수", also: ["/er/t", "/er/i", "/er/example"] },
    ],
  },
];
const TK: Sect = {
  name: "타르코프",
  items: [
    { href: "/tarkov/players", label: "계정 조회", also: ["/tarkov/criteria"] },
    { href: "/tarkov/kord-breach", label: "KORD BREACH" },
  ],
};

const under = (path: string, base: string) => path === base || path.startsWith(`${base}/`);
const hit = (path: string, i: Item) => [i.href, ...(i.also ?? [])].some((b) => under(path, b));

function SectLink({ sect, on }: { sect: Sect; on: boolean }) {
  return (
    <Link className="site-sect" href={sect.items[0].href} aria-current={on ? "true" : undefined}>
      {sect.name}
    </Link>
  );
}

// crumb.href는 지금 화면 항목의 주소를 대신함. 상세에서 목록으로 돌아갈 때 고른 기간을 남기는 데 씀
export default function SiteHeader({
  crumb,
  user,
  children,
}: {
  crumb?: { href: string; label: string };
  user?: AccountUser | null;
  children?: React.ReactNode;
}) {
  const path = usePathname() ?? "/";
  const sect = [...ER, TK].find((g) => g.items.some((i) => hit(path, i)));
  const cur = sect?.items.find((i) => hit(path, i));
  return (
    <header className="site-top">
      <a className="site-skip" href="#main">
        본문으로 건너뛰기
      </a>
      <div className="site-top-in">
        <Link className="site-mark" href="/">
          labs
        </Link>
        <nav className="site-nav" aria-label="사이트">
          <span className="site-game">이터널 리턴</span>
          {ER.map((g) => (
            <SectLink key={g.name} sect={g} on={g === sect} />
          ))}
          <span className="site-sep" aria-hidden="true" />
          <SectLink sect={TK} on={TK === sect} />
        </nav>
        <div className="site-right">
          {children}
          <Account user={user} />
          <ThemeToggle />
        </div>
      </div>
      {sect && (
        <nav className="site-sub" aria-label={`${sect.name} 화면`}>
          {sect.items.map((i) => (
            <Link key={i.href} href={i === cur && crumb && under(crumb.href.split("?")[0], i.href) ? crumb.href : i.href} aria-current={i === cur ? "page" : undefined}>
              {i.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
