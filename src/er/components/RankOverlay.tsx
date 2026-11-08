"use client";

import { useEffect, useState } from "react";
import { rankBadge, type RankView } from "@/er/lib/rank";

const EVERY = 60_000;
const GAIN_FOR = 12 * 3_600_000;

type State = { data: RankView | null; error: string | null };

export default function RankOverlay({ nickname, scale }: { nickname: string; scale: number }) {
  const [state, setState] = useState<State>({ data: null, error: null });
  useEffect(() => {
    document.documentElement.dataset.theme = "dark";
    document.documentElement.classList.add("overlay-page");
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      let wait = EVERY;
      try {
        const r = await fetch(`/api/rank?n=${encodeURIComponent(nickname)}`, { cache: "no-store" });
        const body = (await r.json().catch(() => null)) as (RankView & { error?: string }) | null;
        if (stop) return;
        if (r.ok && body) setState({ data: body, error: null });
        // 봇이 잠깐 응답하지 않을 때는 마지막 값을 그대로 둠
        else if (r.status === 404 || r.status === 400) setState({ data: null, error: body?.error ?? "닉네임을 찾지 못했습니다." });
        else if (r.status === 429) wait = 2 * EVERY;
      } catch {}
      if (!stop) timer = setTimeout(load, wait);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [nickname]);

  const { data, error } = state;
  if (!data) return error ? <div className="tov" style={{ zoom: scale }}><div className="tov-msg">{error}</div></div> : null;
  const badge = rankBadge(data.tier);
  // 오래전 게임의 증감은 이번 방송과 상관없어서 몽실봇이 조회한 시각 기준 12시간 안의 게임만 표시
  const gain = data.last?.at && (data.updatedAt - data.last.at) * 1000 < GAIN_FOR ? data.last.gain : null;
  return (
    <div className="tov" style={{ zoom: scale }}>
      <div className="tov-em" style={{ background: badge.color }}>
        {badge.short}
      </div>
      <div>
        <div className="tov-tn">{data.tier}</div>
        {(data.mmr > 0 || badge.short !== "-") && (
          <div className="tov-rp">
            {data.mmr.toLocaleString("ko-KR")} RP
            {gain !== null && gain !== 0 && (
              <span key={`${data.mmr}:${gain}`} className={gain > 0 ? "up" : "down"}>
                {gain > 0 ? `+${gain}` : gain}
              </span>
            )}
          </div>
        )}
        {data.place && <div className="tov-sv">{data.place}</div>}
      </div>
    </div>
  );
}
