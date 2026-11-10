import Link from "next/link";

// 링크 행은 오른쪽 화살표와 가로선으로 일반 글자와 달라 보이게 그림
export default function RowLinks({ items }: { items: { href: string; label: string }[] }) {
  return (
    <ul className="mt-2 border-t border-rule">
      {items.map((it) => (
        <li key={it.href} className="border-b border-rule">
          <Link href={it.href} className="group flex h-12 items-center gap-3 font-semibold hover:bg-row hover:no-underline">
            {it.label}
            <svg className="ml-auto size-4 flex-none text-ink-3 group-hover:text-ink" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}
