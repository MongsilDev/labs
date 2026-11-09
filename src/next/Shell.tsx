import Link from "next/link";

type Item = { href: string; label: string; key: string };

const ER: Item[] = [
  { key: "tier", href: "/next/er/tier", label: "실험체 티어" },
  { key: "meta", href: "/next/er/meta", label: "메타 지도" },
  { key: "cut", href: "/next/er/cut", label: "이터컷" },
  { key: "rp", href: "/next/er/rp", label: "RP 손익" },
  { key: "kel", href: "/next/er/kel", label: "KEL 기록" },
  { key: "score", href: "/next/er/score", label: "대회 점수" },
];
const TK: Item[] = [
  { key: "players", href: "/next/tarkov/players", label: "계정 조회" },
  { key: "kord", href: "/next/tarkov/kord-breach", label: "KORD BREACH" },
];

function Group({ name, items, here }: { name: string; items: Item[]; here?: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="mr-2 text-[12px] font-semibold text-ink-3">{name}</span>
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={i.key === here ? "page" : undefined}
          className="relative px-2 py-3 text-[14px] font-semibold text-ink-2 hover:text-ink hover:no-underline aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-2 aria-[current=page]:after:bottom-0 aria-[current=page]:after:h-[2px] aria-[current=page]:after:bg-hot"
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export default function Shell({ here, children }: { here?: string; children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-4 lg:px-6">
          <Link href="/next" className="py-3 text-[16px] font-black tracking-[-0.4px] hover:no-underline">
            labs
          </Link>
          <nav className="-mr-4 flex min-w-0 flex-1 items-center gap-6 overflow-x-auto pr-4 [scrollbar-width:none] lg:mr-0 lg:pr-0" aria-label="화면">
            <Group name="이터널 리턴" items={ER} here={here} />
            <span className="h-4 w-px shrink-0 bg-rule-2" aria-hidden="true" />
            <Group name="타르코프" items={TK} here={here} />
          </nav>
          <Link href="/auth/login" className="hidden shrink-0 text-[13px] font-semibold text-ink-2 lg:block">
            로그인
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1320px] px-4 pt-5 pb-16 lg:px-6">{children}</main>
      <footer className="mx-auto flex max-w-[1320px] gap-4 border-t border-rule px-4 py-5 text-[12px] text-ink-3 lg:px-6">
        <Link href="/terms">이용약관</Link>
        <Link href="/privacy">개인정보 처리방침</Link>
      </footer>
    </>
  );
}
