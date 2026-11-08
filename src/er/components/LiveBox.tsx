"use client";

import { useEffect, useState } from "react";
import { api } from "@/er/lib/client";
import { num } from "@/er/lib/format";
import { liveRows, type LiveFrame } from "@/er/lib/live";
import { viewKey, type TournamentView } from "@/er/lib/view";
import { useResult } from "./t/TournamentApp";

const ROWS = 8;
const HEAD = 27;
const ROW = 26;

// 1920x1080 방송 화면의 오른쪽 아래 상자. 값은 지난 라운드까지의 누적과 읽기 탭이 보낸 이번 라운드 TS의 합
export default function LiveBox({ initial, groupIdx, segment }: { initial: TournamentView; groupIdx: number; segment: string }) {
  const [view, setView] = useState(initial);
  const [frame, setFrame] = useState<LiveFrame | null>(null);
  const key = viewKey(initial);
  const idx = view.groups[groupIdx] ? groupIdx : 0;
  const result = useResult(view, idx);
  const played = Math.max(0, ...view.groups[idx].rounds.map((r) => r.roundNo));

  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.add("overlay-page");
    let version = initial.version;
    const t = setInterval(async () => {
      try {
        const next = await api.view(initial.code, version, key);
        // 키로 연 화면의 version은 내용으로 만든 값이라 크기를 비교하지 않음
        if (next && (key || next.version >= version)) {
          version = next.version;
          setView(next);
        }
      } catch (e) {
        if ((e as { status?: number }).status === 404) clearInterval(t);
      }
    }, 5000);
    return () => clearInterval(t);
  }, [initial.code, initial.version, key]);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    let seen = "";
    const tick = async () => {
      let wait = 1000;
      try {
        const r = await fetch(`/api/live/${initial.code}/${segment}`, { cache: "no-store" });
        if (r.status === 404) return;
        if (r.status === 429) wait = 10_000;
        if (r.ok) {
          const d = (await r.json()) as { frame: LiveFrame | null };
          const s = JSON.stringify(d.frame);
          if (!stop && s !== seen) {
            seen = s;
            setFrame(d.frame);
          }
        }
      } catch {}
      if (!stop) timer = setTimeout(tick, wait);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [initial.code, segment]);

  const { rows, live } = liveRows(result.standings, frame, played);
  const head = live ? ["실시간 순위", `R${frame?.roundNo}`] : [result.ended ? "최종 순위" : "누적 순위", played ? `R${played} 종료` : "경기 전"];
  const shown = rows.slice(0, ROWS);
  return (
    <div className="lv">
      <div className="lv-box" style={{ height: `calc(${HEAD + Math.max(1, shown.length) * ROW} * var(--u))` }}>
        <div className="lv-hd">
          <span>{head[0]}</span>
          <span>{head[1]}</span>
        </div>
        {shown.map((r, i) => (
          <div key={r.key} className={`lv-r${r.out ? " out" : ""}`} style={{ top: `calc(${HEAD + i * ROW} * var(--u))` }}>
            <span>{r.rank}</span>
            <b>{r.name}</b>
            <span className="t">{num(r.total)}</span>
            <span className="d">{r.out ? (r.place ? `${r.place}위` : "탈락") : live && r.ts !== null ? `+${num(r.ts)}` : ""}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
