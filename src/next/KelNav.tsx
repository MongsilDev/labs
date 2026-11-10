import Link from "next/link";
import { KEL_SCREENS, KEL_SECTIONS, type KelScreen } from "@/er/lib/kel";

// 휴대폰에서는 묶음 이름 없이 한 줄로 밀고, 시안이 있는 화면만 /next로, 나머지는 운영 주소로 보냄
const NEXT: Partial<Record<KelScreen, string>> = Object.fromEntries((["finals", "records", "players", "circuits", "characters", "comps"] as const).map((k) => [k, `/next/er/kel/${k}`]).concat([["home", "/next/er/kel"]]));
const href = (s: KelScreen) => NEXT[s] ?? KEL_SCREENS[s].path;

export default function KelNav({ here }: { here: KelScreen }) {
  const groups: { title: string; items: KelScreen[] }[] = [{ title: "2026 KEL", items: ["home"] }, ...KEL_SECTIONS];
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:content-start lg:gap-5 lg:px-0" aria-label="KEL 화면">
      {groups.map((g) => (
        <div key={g.title} className="contents lg:grid lg:gap-0.5">
          <h2 className="hidden text-[12px] font-semibold text-ink-3 lg:block">{g.title}</h2>
          <ul className="contents lg:grid">
            {g.items.map((s) => (
              <li key={s} className={`shrink-0 ${s === here ? "order-first lg:order-none" : ""}`}>
                <Link
                  href={href(s)}
                  aria-current={s === here ? "page" : undefined}
                  className="opt lg:h-auto lg:border-0 lg:border-l-2 lg:border-transparent lg:px-2 lg:py-1 lg:aria-[current=page]:border-ink lg:aria-[current=page]:bg-transparent lg:aria-[current=page]:text-ink"
                >
                  {s === "home" ? "요약" : KEL_SCREENS[s].title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
