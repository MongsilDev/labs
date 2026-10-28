"use client";

import { useEffect, useSyncExternalStore } from "react";

function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}

export function useTheme(): "dark" | "light" {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "light" ? "light" : "dark"),
    () => "dark",
  );
}

export default function ThemeToggle() {
  const theme = useTheme();
  // notFound() 응답은 오류 셸을 브라우저에서 그려 layout의 테마 스크립트가 실행되지 않음
  useEffect(() => {
    try {
      const saved = localStorage.getItem("labs-theme");
      if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
    } catch {}
  }, []);
  const next = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={next === "light" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={next === "light" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("labs-theme", next);
        } catch {}
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "light" ? "#eef1f5" : "#0a0d14");
      }}
    >
      {theme === "light" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />
        </svg>
      )}
    </button>
  );
}
