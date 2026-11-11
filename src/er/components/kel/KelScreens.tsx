"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { KEL_SCREENS, KEL_SECTIONS, kelVisible, type KelScreen } from "@/er/lib/kel";

export default function KelScreens({ owner }: { owner: boolean }) {
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  const groups = [["home" as KelScreen], ...KEL_SECTIONS.map((g) => g.items.filter((s) => kelVisible(s, owner)))].filter((g) => g.length);
  const on = (s: KelScreen) => (s === "home" ? path === KEL_SCREENS.home.path : path.startsWith(KEL_SCREENS[s].path));
  // 좁은 폭에서는 줄이 가로로 넘쳐 현재 화면이 가려질 수 있음
  useEffect(() => {
    const el = box.current, cur = el?.querySelector<HTMLElement>("[aria-current]");
    if (el && cur) el.scrollLeft += cur.getBoundingClientRect().left - el.getBoundingClientRect().left - (el.clientWidth - cur.offsetWidth) / 2;
  }, [path]);
  return (
    <nav className="kel-nav" aria-label="KEL 화면">
      <div className="kel-nav-in" ref={box}>
        {groups.map((g) => (
          <ul key={g[0]}>
            {g.map((s) => (
              <li key={s}>
                <Link href={KEL_SCREENS[s].path} aria-current={on(s) ? "page" : undefined} prefetch={false}>
                  {s === "home" ? "요약" : KEL_SCREENS[s].title}
                </Link>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </nav>
  );
}
