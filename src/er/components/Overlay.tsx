"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "@/er/lib/client";
import { num } from "@/er/lib/format";
import { viewKey, type TournamentView } from "@/er/lib/view";
import { barTotal } from "@/er/lib/engine";
import Bar from "./t/Bar";
import { useResult } from "./t/TournamentApp";

export default function Overlay({
  initial,
  groupIdx,
  limit,
  scale,
  side,
}: {
  initial: TournamentView;
  groupIdx: number;
  limit: number;
  scale: number;
  side: "left" | "right";
}) {
  const [view, setView] = useState(initial);
  const version = useRef(initial.version);
  const key = viewKey(initial);
  const idx = view.groups[groupIdx] ? groupIdx : 0;
  const result = useResult(view, idx);
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.add("overlay-page");
    const t = setInterval(async () => {
      try {
        const next = await api.view(view.code, version.current, key);
        // 키로 연 화면의 version은 내용으로 만든 값이라 크기를 비교하지 않음
        if (next && (key || next.version >= version.current)) {
          version.current = next.version;
          setView(next);
        }
      } catch (e) {
        if ((e as { status?: number }).status === 404) clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [view.code, key]);
  const g = view.groups[idx];
  const rows = result.standings.slice(0, limit);
  const box = useRef<HTMLDivElement>(null);
  // 지정 배율에서 화면 높이를 넘으면 맞을 때까지 줄임
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      let z = scale;
      for (let i = 0; i < 4; i++) {
        el.style.zoom = String(z);
        el.style.setProperty("--zoom-fix", String(z));
        const h = el.getBoundingClientRect().height;
        const room = window.innerHeight - 48;
        if (h <= room + 1) break;
        z = Math.max(0.3, (z * room) / h);
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [scale, rows.length, view.version]);
  const max = Math.max(1, ...result.standings.map(barTotal));
  const status = result.ended ? "최종 순위" : result.played ? `${result.played}라운드 종료` : "경기 전";
  return (
    <div ref={box} className={`ov${side === "left" ? " left" : ""}${rows.length > 12 ? " dense" : ""}`} style={{ zoom: scale, ["--n" as string]: rows.length, ["--zoom-fix" as string]: scale }}>
      <div className="ov-hd">
        <b>
          {view.name}
          {view.groupCount > 1 ? ` ${g.label}조` : ""}
        </b>
        <span>{status}</span>
      </div>
      {rows.map((s) => (
        <div key={s.key} className={`ov-row${view.rules.advance > 0 && s.rank === view.rules.advance ? " cut" : ""}`}>
          <span className={`rk ${s.rank === 1 ? "first" : view.rules.advance > 0 && s.rank <= view.rules.advance ? "adv" : ""}`}>{s.rank}</span>
          <div className="ov-mid">
            <div className="ov-nm">
              <span>{s.name}</span>
              {s.fixed ? <i className="cp">{s.fixed}위 확정</i> : s.checkpoint && view.mode !== "points" ? <i className="cp">체크포인트</i> : null}
            </div>
            <Bar s={s} max={max} rounds={result.played} height={6} labels={false} />
          </div>
          <span className="ov-tt">{num(s.total)}</span>
        </div>
      ))}
    </div>
  );
}
