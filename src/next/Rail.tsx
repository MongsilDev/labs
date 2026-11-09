import Link from "next/link";

export type RailGroup = { name: string; items: { href: string; label: string; on: boolean }[] };

// 휴대폰에서는 줄마다 가로로 밀고, 넓은 화면에서는 왼쪽 세로 목록
export default function Rail({ groups }: { groups: RailGroup[] }) {
  return (
    <nav className="grid content-start gap-4 lg:gap-6" aria-label="필터">
      {groups.map((g) => (
        <div key={g.name} className="grid gap-1.5 lg:gap-1">
          <h2 className="text-[12px] font-semibold text-ink-3">{g.name}</h2>
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:px-0">
            {g.items.map((i) => (
              <li key={i.href} className="shrink-0">
                <Link
                  href={i.href}
                  aria-current={i.on ? "page" : undefined}
                  className="block border border-rule px-2.5 py-1 text-[13px] font-semibold text-ink-2 hover:no-underline aria-[current=page]:border-ink aria-[current=page]:text-ink lg:border-0 lg:border-l-2 lg:border-transparent lg:px-2 lg:py-1 lg:aria-[current=page]:border-hot"
                >
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
