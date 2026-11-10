import Link from "next/link";
import Theme from "./Theme";

type Item = { href: string; label: string; key: string };
type Sect = { name: string; items: Item[] };

// lg 아래에서는 열 항목이 넘쳐 위 줄은 묶음, 아래 줄은 현재 묶음의 화면만 보임
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
      { key: "overlay", href: "/next/er/overlay", label: "방송 화면" },
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

const top = "relative shrink-0 px-1.5 py-3 focus-visible:!-outline-offset-2 text-[14px] font-semibold text-ink-2 hover:text-ink hover:no-underline aria-[current=true]:text-ink aria-[current=true]:after:absolute aria-[current=true]:after:inset-x-1.5 aria-[current=true]:after:bottom-0 aria-[current=true]:after:h-[2px] aria-[current=true]:after:bg-ink sm:px-2 sm:aria-[current=true]:after:inset-x-2";

function Wide({ name, items, here }: { name: string; items: Item[]; here?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* 1280 아래에서는 열 항목이 한 줄에 들어가도록 묶음 이름을 뺌 */}
      <span className="mr-2 hidden text-[12px] font-semibold text-ink-3 xl:inline">{name}</span>
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === here ? "page" : undefined}
          className="relative px-2 py-3 text-[14px] font-semibold text-ink-2 hover:text-ink hover:no-underline aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-[2px] aria-[current=page]:after:bg-ink"
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

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
        <div className="mx-auto flex w-full max-w-[1320px] items-center gap-3 px-4 sm:gap-5 lg:px-6">
          <Link href="/next" className="py-3 text-[16px] font-black tracking-[-0.4px] hover:no-underline">
            labs
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center gap-6 lg:flex" aria-label="사이트">
            <Wide name="이터널 리턴" items={ER.flatMap((g) => g.items)} here={here} />
            <span className="h-4 w-px shrink-0 bg-rule-2" aria-hidden="true" />
            <Wide name="타르코프" items={TK.items} here={here} />
          </nav>
          <nav className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] sm:gap-1 lg:hidden" aria-label="사이트">
            <span className="mr-1 hidden shrink-0 text-[12px] font-semibold text-ink-3 sm:inline">이터널 리턴</span>
            {ER.map((g) => <SectLink key={g.name} sect={g} on={g === sect} />)}
            <span className="mx-1 h-4 w-px shrink-0 bg-rule-2 sm:mx-2" aria-hidden="true" />
            <SectLink sect={TK} on={TK === sect} />
          </nav>
          <div className="flex shrink-0 items-center gap-2.5">
            <Link href="/auth/login" className="flex h-11 items-center text-[13px] font-semibold text-ink-2 hover:text-ink hover:no-underline">
              로그인
            </Link>
            <Theme />
          </div>
        </div>
        {sect && (
          <nav className="mx-auto flex w-full max-w-[1320px] gap-5 overflow-x-auto px-4 [scrollbar-width:none] lg:px-6 lg:hidden" aria-label={`${sect.name} 화면`}>
            {sect.items.map((i) => (
              <Link
                key={i.key}
                href={i.href}
                aria-current={i.key === here ? "page" : undefined}
                className="shrink-0 border-b-2 border-transparent py-3 text-[13px] font-semibold text-ink-3 hover:text-ink hover:no-underline aria-[current=page]:border-ink aria-[current=page]:text-ink"
              >
                {i.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-16 lg:px-6">{children}</main>
      <footer className="mx-auto flex w-full max-w-[1320px] gap-4 border-t border-rule px-4 py-5 text-[12px] text-ink-3 lg:px-6">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보 처리방침</Link>
      </footer>
    </>
  );
}
