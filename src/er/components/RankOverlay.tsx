"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { isRanked, rankEmblem, type Place, type RankView } from "@/er/lib/rank";

const EVERY = 60_000;
const GAIN_FOR = 12 * 3_600_000;
const BASE_FOR = 12 * 3_600_000;

type State = { data: RankView | null; error: string | null; today: number };
type ViewProps = { data: RankView; style: CSSProperties; today: number };

const u = (n: number | undefined) => (n === undefined ? undefined : `calc(${n} * var(--u))`);
const num = (v: number) => v.toLocaleString("ko-KR");
const signed = (v: number) => (v > 0 ? `+${num(v)}` : num(v));

// 이번 방송 RP의 기준값. OBS가 소스를 다시 불러와도 이어지게 브라우저에 12시간 동안 기억
function sessionGain(nickname: string, mmr: number): number {
  const key = `tov-base:${nickname.toLowerCase()}`;
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null") as { mmr: number; at: number } | null;
    if (saved && typeof saved.mmr === "number" && Date.now() - saved.at < BASE_FOR) return mmr - saved.mmr;
    localStorage.setItem(key, JSON.stringify({ mmr, at: Date.now() }));
  } catch {}
  return 0;
}

function useTween(value: number): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const a = from.current;
    const ms = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 600;
    const t0 = performance.now();
    let raf = requestAnimationFrame(function step(t) {
      const k = ms ? Math.min(1, (t - t0) / ms) : 1;
      from.current = Math.round(a + (value - a) * (1 - (1 - k) ** 3));
      setShown(from.current);
      if (k < 1) raf = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

function Emblem({ tier }: { tier: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="tov-em" src={rankEmblem(tier)} alt="" />;
}

function Gain({ data }: { data: RankView }) {
  // 오래전 게임의 증감은 이번 방송과 상관없어서 몽실봇이 조회한 시각 기준 12시간 안의 게임만 표시
  const gain = data.last?.at && (data.updatedAt - data.last.at) * 1000 < GAIN_FOR ? data.last.gain : null;
  if (gain === null || gain === 0) return null;
  return (
    <span key={`${data.mmr}:${gain}`} className={`tov-up${gain < 0 ? " dn" : ""}`}>
      {signed(gain)}
    </span>
  );
}

function Recent({ list }: { list: number[] }) {
  return (
    <div className="tov-f">
      <span className="tov-l">최근</span>
      <div className="tov-chips">
        {list.map((p, i) => (
          <span key={i} className={`tov-c${p === 1 ? " win" : p <= 3 ? " top3" : ""}`}>
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

function T1({ data, style }: ViewProps) {
  return (
    <div className="tov-p tov-t1" style={style}>
      <div className="tov-hd">
        <Emblem tier={data.tier} />
        <div className="tov-m">
          <div className="tov-n">{data.nickname}</div>
          <div className="tov-tn">{data.tier}</div>
          {(data.mmr > 0 || isRanked(data.tier)) && (
            <div className="tov-rp">
              {num(data.mmr)} RP
              <Gain data={data} />
            </div>
          )}
          {data.place && <div className="tov-sv">{data.place}</div>}
        </div>
      </div>
      {data.recent.length > 0 && <Recent list={data.recent} />}
    </div>
  );
}

function T2({ data, style }: ViewProps) {
  return (
    <div className="tov-p tov-t2" style={style}>
      <Emblem tier={data.tier} />
      <b>{data.tier}</b>
      {(data.mmr > 0 || isRanked(data.tier)) && <span className="tov-rp">{num(data.mmr)} RP</span>}
      <Gain data={data} />
    </div>
  );
}

function T3({ data, style, today: value }: ViewProps) {
  const today = useTween(value);
  return (
    <div className="tov-p tov-t3" style={style}>
      <div className="tov-hd">
        <Emblem tier={data.tier} />
        <div className="tov-m">
          <b>{data.tier}</b>
          {(data.mmr > 0 || isRanked(data.tier)) && <span>{num(data.mmr)} RP</span>}
        </div>
        <div className="tov-d">
          <span>이번 방송</span>
          <b className={today < 0 ? "dn" : undefined}>{signed(today)}</b>
        </div>
      </div>
      {data.recent.length > 0 && <Recent list={data.recent} />}
    </div>
  );
}

const VIEWS = { t1: T1, t2: T2, t3: T3 };

export default function RankOverlay({ nickname, place }: { nickname: string; place: Place }) {
  const [state, setState] = useState<State>({ data: null, error: null, today: 0 });
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
        if (r.ok && body) setState({ data: body, error: null, today: sessionGain(nickname, body.mmr) });
        // 봇이 잠깐 응답하지 않을 때는 마지막 값을 그대로 둠
        else if (r.status === 404 || r.status === 400) setState({ data: null, error: body?.error ?? "닉네임을 찾지 못했습니다.", today: 0 });
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

  const style: CSSProperties = { left: u(place.left), right: u(place.right), top: u(place.top), bottom: u(place.bottom) };
  const { data, error, today } = state;
  const View = VIEWS[place.preset];
  return (
    <div className="tov">
      {data ? (
        <View data={data} style={style} today={today} />
      ) : (
        error && (
          <div className="tov-p tov-msg" style={style}>
            {error}
          </div>
        )
      )}
    </div>
  );
}
