"use client";

import { useRef, useState } from "react";

export type HubTab = { id: string; label: string; note?: string; panel: React.ReactNode };

/** 시안 2 무대. 왼쪽 탭에서 고른 기능 하나만 크게 보이고, children은 탭 아래 작은 줄 */
export default function HubTabs({ tabs, children }: { tabs: HubTab[]; children?: React.ReactNode }) {
  const [at, setAt] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const next = (i + tabs.length) % tabs.length;
    setAt(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="hub2">
      <div
        className="hub2-tabs"
        role="tablist"
        aria-label="기능"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowRight") move(at + 1);
          else if (e.key === "ArrowUp" || e.key === "ArrowLeft") move(at - 1);
          else if (e.key === "Home") move(0);
          else if (e.key === "End") move(tabs.length - 1);
          else return;
          e.preventDefault();
        }}
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`hub2-t-${t.id}`}
            aria-selected={i === at}
            aria-controls={`hub2-p-${t.id}`}
            tabIndex={i === at ? 0 : -1}
            onClick={() => setAt(i)}
          >
            <b>{t.label}</b>
            <span className="num">{t.note}</span>
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.id} className="hub2-stage" role="tabpanel" id={`hub2-p-${t.id}`} aria-labelledby={`hub2-t-${t.id}`} hidden={i !== at}>
          {t.panel}
        </div>
      ))}
      <div className="hub2-more">{children}</div>
    </div>
  );
}
