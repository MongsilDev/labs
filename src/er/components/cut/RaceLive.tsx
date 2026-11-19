"use client";

import Link from "next/link";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { int, type RaceData, TIERS } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";

const GATE = 8300;
const EVERY = 60_000;
const Ctx = createContext<RaceData | null>(null);

const hm = (s: number) => new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(s * 1000);
const signed = (v: number | null | undefined) => (v == null ? "-" : v > 0 ? `+${int(v)}` : int(v));

/** 수집기가 1분마다 쓰는 race.json을 새로고침 없이 다시 받음. 엣지가 HTML을 5분 캐시해서 첫 값이 낡았을 수 있어 열자마자 한 번 받음 */
export function RaceLive({ initial, children }: { initial: RaceData; children: ReactNode }) {
  const [race, setRace] = useState(initial);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.hidden) return;
      try {
        const d = (await (await fetch("/api/race", { cache: "no-store" })).json()) as RaceData | null;
        // 닫히거나 낡아 null이 오면 칸 구성이 바뀌므로 다음 새로고침까지 마지막 값을 둠
        if (!stop && d?.list && d.season === initial.season) setRace((r) => (d.updatedAt > r.updatedAt ? d : r));
      } catch {}
    };
    load();
    const id = setInterval(load, EVERY);
    document.addEventListener("visibilitychange", load);
    return () => {
      stop = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [initial.season]);
  return <Ctx value={race}>{children}</Ctx>;
}

const useRace = () => useContext(Ctx);

export function RaceCount() {
  const race = useRace();
  return race ? int(race.count) : null;
}

/** 컷 그래프를 그릴 기록이 없는 시즌 초에 그 자리에 두는 8,300 도달 상위 목록. 옆 기둥 표와 같은 줄 높이 */
export function RaceMini({ rows = 5 }: { rows?: number }) {
  const race = useRace();
  if (!race?.list.length) return null;
  return (
    <Link href="/er/cut" className="race-mini">
      <table className="tbl tierbig">
        <thead className="sr-only"><tr><th className="l w-8">#</th><th className="l">닉네임</th><th>RP</th><th>최근 판</th><th>{int(GATE)}까지</th></tr></thead>
        <tbody>
          {race.list.slice(0, rows).map((r, i) => (
            <tr key={r.nickname}>
              <td className="l text-ink-3">{i + 1}</td>
              <td className="l w-full max-w-0 truncate"><b className="tb-team">{r.nickname}</b></td>
              <td className="text-ink-2">{int(r.rp)}</td>
              <td className="text-ink-3">{signed(r.diff)}</td>
              <td className="tb-score">
                {r.at != null || r.rp >= GATE ? <span style={{ color: TIERS[0].color }}>달성</span> : <>{int(GATE - r.rp)}<small>남음</small></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Link>
  );
}

/** 도달한 계정은 도달 순서로, 못 닿은 계정은 RP순으로. 막대는 표의 최저 RP 조금 아래부터 8,300까지 */
export function RaceTable() {
  const race = useRace();
  if (!race?.list.length) return null;
  const { list } = race;
  const color = TIERS[0].color;
  const floor = Math.min(GATE, ...list.map((r) => r.rp)) - 150;
  const width = (rp: number) => `${Math.max(4, Math.min(100, ((rp - floor) / (GATE - floor)) * 100))}%`;
  return (
    <section className="sec mt-4" aria-labelledby="race-h">
      <div className="flex items-baseline gap-3">
        <h2 className="sec-h" id="race-h">이터런</h2>
        <p className="text-[12px] text-ink-3 num">{hm(race.updatedAt)} 기준</p>
      </div>
      <table className="mt-3 w-full table-fixed text-[13px] num">
        <thead className="text-left text-[12px] text-ink-3">
          <tr className="border-b border-rule">
            <th className="w-8 py-2 font-semibold">#</th>
            <th className="py-2 font-semibold sm:w-[20%]">닉네임</th>
            <th className="w-16 py-2 text-right font-semibold">RP</th>
            <th className="hidden py-2 pl-6 sm:table-cell">
              <span className="sr-only">진행</span>
            </th>
            <th className="w-[84px] py-2 pl-2 text-right font-semibold whitespace-nowrap sm:w-36 sm:pl-4">{int(GATE)}까지</th>
            <th className="w-14 py-2 pl-2 text-right font-semibold whitespace-nowrap sm:w-20 sm:pl-4">최근 판</th>
          </tr>
        </thead>
        <tbody>
          {list.map((r, k) => {
            const done = r.at != null || r.rp >= GATE;
            return (
              <tr key={r.nickname} className="border-b border-rule">
                <td className="py-2 text-ink-3">{k + 1}</td>
                <td className="truncate py-2 font-semibold">{r.nickname}</td>
                <td className="py-2 text-right">{int(r.rp)}</td>
                <td className="hidden py-2 pl-6 sm:table-cell">
                  <span className="block h-1.5 bg-rule" aria-hidden="true">
                    <span className="block h-full" style={{ width: width(r.rp), background: done ? color : "var(--color-ink-3)" }} />
                  </span>
                </td>
                <td className="py-2 pl-2 text-right whitespace-nowrap sm:pl-4">
                  {done ? (
                    <span style={{ color }}>
                      {r.at ? timeKo(r.at * 1000).replace(/^\d+월 /, "") : ""}
                      <span className={r.at ? "max-sm:hidden" : undefined}>{r.at ? " " : ""}달성</span>
                    </span>
                  ) : (
                    int(GATE - r.rp)
                  )}
                </td>
                <td className="py-2 pl-2 text-right text-ink-3 sm:pl-4">{signed(r.diff)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
