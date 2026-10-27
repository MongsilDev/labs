"use client";

import { useLayoutEffect, useRef, useState } from "react";

// 넘치는 표는 오른쪽 끝이 열 경계에 오도록 폭을 줄여 반쯤 잘린 칸이 보이지 않게 함
function fit(el: HTMLDivElement) {
  el.style.maxWidth = "";
  const row = el.querySelector("tbody tr") as HTMLTableRowElement | null;
  if (!row || el.scrollWidth <= el.clientWidth) return;
  const cells = [...row.cells].filter((c) => c.offsetWidth);
  const sticky = (c: HTMLTableCellElement) => getComputedStyle(c).position === "sticky";
  const pin = cells.filter(sticky).reduce((n, c) => n + c.offsetWidth, 0);
  // sticky 칸은 offsetParent가 표가 아니라서 화면 좌표로 계산
  const left = el.getBoundingClientRect().left - el.scrollLeft;
  const edges = cells.filter((c) => !sticky(c)).map((c) => c.getBoundingClientRect().right - left).filter((x) => x > pin && x <= el.clientWidth);
  if (edges.length) el.style.maxWidth = `${Math.max(...edges)}px`;
  el.style.scrollPaddingInlineStart = `${pin}px`;
}

// 표를 감싼 구역과 이름이 겹치지 않게 뒤에 '표'를 붙임. 폭을 넘는 표만 키보드 초점을 받고, 초점이 있는 동안은 그대로 둠
export default function KelScroll({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      fit(el);
      setScrolls(el.scrollWidth > el.clientWidth || el === document.activeElement);
    });
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`kel-scroll scroll-fade overflow-x-auto ${className}`}
      onBlur={(e) => setScrolls(e.currentTarget.scrollWidth > e.currentTarget.clientWidth)}
      role="region"
      aria-label={`${label} 표`}
      tabIndex={scrolls ? 0 : undefined}
    >
      {children}
    </div>
  );
}
