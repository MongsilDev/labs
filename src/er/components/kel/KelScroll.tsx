"use client";

import { useLayoutEffect, useRef, useState } from "react";

// 넘치는 표는 고정 칸을 남는 폭만큼 넓혀 처음 화면의 오른쪽 끝이 열 경계에 오게 함
function fit(el: HTMLDivElement) {
  const row = el.querySelector("tbody tr") as HTMLTableRowElement | null;
  if (!row) return;
  const cells = [...row.cells].filter((c) => c.offsetWidth);
  const sticky = (c: HTMLTableCellElement) => getComputedStyle(c).position === "sticky";
  // 고정 칸이 없는 표는 가장 넓은 왼쪽 정렬 칸을 넓힘
  const last = cells.filter(sticky).at(-1) ?? cells.filter((c) => c.classList.contains("l")).sort((a, b) => b.offsetWidth - a.offsetWidth)[0];
  if (last) last.style.minWidth = "";
  el.removeAttribute("data-fit");
  if (el.scrollWidth <= el.clientWidth) return;
  // sticky 칸은 offsetParent가 표가 아니라서 화면 좌표로 계산
  const left = el.getBoundingClientRect().left - el.scrollLeft;
  const pinEnd = () => (last ? last.getBoundingClientRect().right - left : 0);
  // 고정 칸을 넓히면 다른 열 폭도 다시 나뉘어서 몇 번 되풀이해 맞춤
  for (let n = 0; last && n < 6; n++) {
    const edges = cells.filter((c) => !sticky(c)).map((c) => c.getBoundingClientRect().right - left).filter((x) => x > pinEnd() + 1 && x <= el.clientWidth + 0.5);
    if (!edges.length) break;
    const rest = el.clientWidth - Math.max(...edges);
    if (rest < 0.5) {
      el.setAttribute("data-fit", "");
      break;
    }
    last.style.minWidth = `${last.getBoundingClientRect().width + rest}px`;
  }
  el.style.scrollPaddingInlineStart = cells.some(sticky) ? `${pinEnd()}px` : "";
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
