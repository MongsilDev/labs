"use client";

import { useEffect, useState } from "react";

type Tip = { text: string; x: number; top: number; bottom: number };

/** data-tip을 가진 요소에 마우스를 올리거나 탭하면 그 글을 요소 위에 띄움. 다른 곳을 가리키거나 스크롤하면 닫음 */
export default function Tips() {
  const [tip, setTip] = useState<Tip | null>(null);
  useEffect(() => {
    const show = (e: Event) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-tip]") : null;
      if (!el) return setTip(null);
      const r = el.getBoundingClientRect();
      setTip({ text: el.dataset.tip ?? "", x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
    };
    const hide = () => setTip(null);
    // 포인터가 창 밖으로 바로 나가면 pointerover가 오지 않음
    const left = (e: PointerEvent) => {
      if (!e.relatedTarget) hide();
    };
    document.addEventListener("pointerover", show);
    document.addEventListener("pointerout", left);
    document.addEventListener("click", show);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      document.removeEventListener("pointerover", show);
      document.removeEventListener("pointerout", left);
      document.removeEventListener("click", show);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);
  if (!tip) return null;
  // 가로는 화면 안 위치 비율만큼 왼쪽으로 당겨 가장자리에서도 잘리지 않고, 위에 자리가 없으면 아래에 띄움
  const px = Math.min(100, Math.max(0, (tip.x / window.innerWidth) * 100));
  const above = tip.top > 44;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 w-max border border-rule-2 bg-bg px-2.5 py-1.5 text-[12px] whitespace-nowrap text-ink-2 num"
      style={{ left: tip.x, top: above ? tip.top - 6 : tip.bottom + 6, transform: `translate(-${px}%, ${above ? "-100%" : "0"})` }}
    >
      {tip.text}
    </div>
  );
}
