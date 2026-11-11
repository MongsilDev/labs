"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { RankPanel } from "@/er/components/RankOverlay";
import { overlayPlace, type RankView } from "@/er/lib/rank";

// 닉네임을 넣기 전이고 1위 자료도 없을 때 그리는 지어낸 값. at과 updatedAt이 같아야 직전 게임 증감이 표시됨
const SAMPLE: RankView = { nickname: "닉네임", tier: "메테오라이트 3", mmr: 6842, place: "상위 4.2%", serverRank: null, serverCode: null, last: { gain: 38, at: 1 }, recent: [1, 4, 2, 7, 3, 1, 5, 2, 6, 3], updatedAt: 1 };

const FAILED = "티어를 불러오지 못했습니다.";

type Live = { data: RankView | null; error: string | null };

/** top은 닉네임을 넣기 전에 보여 줄 아시아1 1위 */
export default function RankPreview({ form, nick, top, init }: { form: string; nick: string; top: RankView | null; init: string }) {
  // 브라우저가 되살린 입력값도 따라가게 폼에서 직접 읽음
  const picked = useSyncExternalStore(
    (changed) => {
      const el = document.getElementById(form);
      el?.addEventListener("input", changed);
      return () => el?.removeEventListener("input", changed);
    },
    () => {
      const el = document.getElementById(form);
      if (!(el instanceof HTMLFormElement)) return init;
      const f = new FormData(el);
      return `${f.get("p")}|${f.get("x")}|${f.get("y")}`;
    },
    () => init,
  );
  const [p, x, y] = picked.split("|");
  const place = overlayPlace(p, x, y);

  const [live, setLive] = useState<Live | null>(null);
  useEffect(() => {
    if (!nick) return;
    let stop = false;
    // 방송 화면은 1분마다 조회하고 여기서는 주소를 만들 때 한 번만 조회
    fetch(`/api/rank?n=${encodeURIComponent(nick)}`, { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as (RankView & { error?: string }) | null;
        if (stop) return;
        setLive(r.ok && body ? { data: body, error: null } : { data: null, error: body?.error ?? FAILED });
      })
      .catch(() => {
        if (!stop) setLive({ data: null, error: FAILED });
      });
    return () => {
      stop = true;
    };
  }, [nick]);

  // 한 줄 프리셋은 닉네임을 그리지 않아서, 닉네임을 넣은 뒤에는 지어낸 값을 그 선수의 값처럼 보이지 않게 그리지 않음
  const view = live ? { ...live, today: 0 } : nick ? null : top ? { data: top, error: null, today: 0 } : { data: SAMPLE, error: null, today: 38 };
  return (
    <div role="group" aria-label="미리보기">
      <div className="ovp-screen" aria-hidden="true">
        {view && (
          <div className="tov">
            <RankPanel {...view} place={place} />
          </div>
        )}
      </div>
      {view && (
        <div className="ovp-one">
          <div className="tov">
            <RankPanel {...view} place={{ preset: place.preset }} />
          </div>
        </div>
      )}
    </div>
  );
}
