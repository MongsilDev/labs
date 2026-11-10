"use client";

import { useTheme } from "@/components/ThemeToggle";

const COLOR = { dark: "#121212", light: "#fafaf9" };

export default function Theme() {
  const theme = useTheme();
  const next = theme === "light" ? "dark" : "light";
  const label = next === "light" ? "밝은 테마로 바꾸기" : "어두운 테마로 바꾸기";
  return (
    <button
      type="button"
      // 보이는 크기는 32px이고 누르는 범위만 44px
      className="relative grid size-8 flex-none cursor-pointer after:absolute after:-inset-1.5 place-items-center rounded-[2px] border border-rule-2 text-ink-2 hover:border-ink-3 hover:text-ink"
      aria-label={label}
      title={label}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("labs-theme", next);
        } catch {}
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", COLOR[next]);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
        {theme === "light" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        )}
      </svg>
    </button>
  );
}
