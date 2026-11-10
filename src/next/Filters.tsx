import Link from "next/link";
import Pick from "./Pick";

export type FilterGroup = { name: string; items: { href: string; label: string; on: boolean }[] };

// 표 위 한 줄. sm 아래에서는 묶음마다 지금 값만 보이는 select로 바뀜
export default function Filters({ groups }: { groups: FilterGroup[] }) {
  return (
    <nav className="mt-4" aria-label="필터">
      <div className="hidden flex-wrap items-center gap-x-7 gap-y-2 sm:flex">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-2.5">
            <span className="text-[12px] font-semibold text-ink-3">{g.name}</span>
            <ul className="flex">
              {g.items.map((i) => (
                <li key={i.href} className="-ml-px first:ml-0">
                  <Link href={i.href} aria-current={i.on ? "page" : undefined} className="opt aria-[current]:relative">
                    {i.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 sm:hidden">
        {groups.map((g) => (
          <Pick key={g.name} name={g.name} items={g.items} />
        ))}
      </div>
    </nav>
  );
}
