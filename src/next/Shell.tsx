import Link from "next/link";

type Item = { href: string; label: string; key: string };
type Sect = { name: string; items: Item[] };

// 휴대폰 폭에서 아홉 항목이 넘쳐 위 줄은 묶음, 아래 줄은 현재 묶음의 화면만 보임
const ER: Sect[] = [
  {
    name: "실험체",
    items: [
      { key: "tier", href: "/next/er/tier", label: "실험체 티어" },
      { key: "meta", href: "/next/er/meta", label: "메타 지도" },
      { key: "late", href: "/next/er/late", label: "초반과 막판" },
    ],
  },
  {
    name: "랭크",
    items: [
      { key: "cut", href: "/next/er/cut", label: "이터컷" },
      { key: "rp", href: "/next/er/rp", label: "RP 손익" },
    ],
  },
  {
    name: "대회",
    items: [
      { key: "kel", href: "/next/er/kel", label: "KEL 기록" },
      { key: "score", href: "/next/er/score", label: "대회 점수" },
    ],
  },
];
const TK: Sect = {
  name: "타르코프",
  items: [
    { key: "players", href: "/next/tarkov/players", label: "계정 조회" },
    { key: "kord", href: "/next/tarkov/kord-breach", label: "KORD BREACH" },
  ],
};

const top = "relative shrink-0 px-2 py-3 focus-visible:!-outline-offset-2 text-[14px] font-semibold text-ink-2 hover:text-ink hover:no-underline aria-[current=true]:text-ink aria-[current=true]:after:absolute aria-[current=true]:after:inset-x-2 aria-[current=true]:after:bottom-0 aria-[current=true]:after:h-[2px] aria-[current=true]:after:bg-hot";

function SectLink({ sect, on }: { sect: Sect; on: boolean }) {
  return (
    <Link href={sect.items[0].href} aria-current={on ? "true" : undefined} className={top}>
      {sect.name}
    </Link>
  );
}

export default function Shell({ here, children }: { here?: string; children: React.ReactNode }) {
  const sect = [...ER, TK].find((g) => g.items.some((i) => i.key === here));
  return (
    <>
      <a href="#main" className="absolute -left-[9999px] z-50 bg-ink px-3 py-2 text-[13px] font-semibold !text-bg focus:top-3 focus:left-3">
        본문으로 건너뛰기
      </a>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1320px] items-center gap-5 px-4 lg:px-6">
          <Link href="/next" className="py-3 text-[16px] font-black tracking-[-0.4px] hover:no-underline">
            labs
          </Link>
          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="사이트">
            <span className="mr-1 hidden shrink-0 text-[12px] font-semibold text-ink-3 sm:inline">이터널 리턴</span>
            {ER.map((g) => <SectLink key={g.name} sect={g} on={g === sect} />)}
            <span className="mx-2 h-4 w-px shrink-0 bg-rule-2" aria-hidden="true" />
            <SectLink sect={TK} on={TK === sect} />
          </nav>
          <Link href="/auth/login" className="hidden shrink-0 text-[13px] font-semibold text-ink-2 lg:block">
            로그인
          </Link>
        </div>
        {sect && (
          <nav className="mx-auto flex max-w-[1320px] gap-5 overflow-x-auto px-4 [scrollbar-width:none] lg:px-6" aria-label={`${sect.name} 화면`}>
            {sect.items.map((i) => (
              <Link
                key={i.key}
                href={i.href}
                aria-current={i.key === here ? "page" : undefined}
                className="shrink-0 border-b-2 border-transparent pt-1 pb-2 text-[13px] font-semibold text-ink-3 hover:text-ink hover:no-underline aria-[current=page]:border-ink aria-[current=page]:text-ink"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto max-w-[1320px] px-4 pt-5 pb-16 lg:px-6">{children}</main>
      <footer className="mx-auto flex max-w-[1320px] gap-4 border-t border-rule px-4 py-5 text-[12px] text-ink-3 lg:px-6">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보 처리방침</Link>
      </footer>
    </>
  );
}
