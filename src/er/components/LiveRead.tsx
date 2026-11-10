"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api } from "@/er/lib/client";
import { num } from "@/er/lib/format";
import type { WorkerIn, WorkerOut } from "@/er/lib/hud.worker";
import { SLOTS, suggestTeams } from "@/er/lib/live";
import { applyRead, emptySlots, fixSlot, unfixAll, type Slot } from "@/er/lib/live-read";
import { firstPath, type TournamentView } from "@/er/lib/view";
import { useResult } from "./t/TournamentApp";

type Props = { initial: TournamentView; groupIdx: number; segment: string };
type Source = "screen" | "video" | "image";
type Processor = new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<VideoFrame> };

const BOX = "panel px-5 py-[18px] [section+&]:mt-3.5";
const H2 = "flex flex-wrap items-baseline gap-2 text-[15px] font-bold";
const EVERY = 1000;
const noop = () => () => {};
const clock = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// 연결한 팀과 카드 번호는 브라우저에 저장해서 새로고침해도 유지. 서버 렌더와 어긋나지 않게 브라우저에서만 그림
export default function LiveRead(props: Props) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return mounted ? <Reader {...props} /> : null;
}

const playedOf = (view: TournamentView, idx: number) => Math.max(0, ...(view.groups[idx]?.rounds.map((r) => r.roundNo) ?? []));

function loadMap(key: string): { teams: Record<number, string>; names: Record<number, string> } | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function Reader({ initial, groupIdx, segment }: Props) {
  const [view, setView] = useState(initial);
  const result = useResult(view, groupIdx);
  const played = playedOf(view, groupIdx);
  const storeKey = `er-live-map:${view.code}:${segment}`;
  const [roundNo, setRoundNo] = useState(played + 1);
  const [seen, setSeen] = useState(played);
  const [slots, setSlots] = useState<Slot[]>(emptySlots);
  const [ended, setEnded] = useState(false);
  const [source, setSource] = useState<Source | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Record<number, string>>(() => ({ ...suggestTeams(result.standings), ...loadMap(storeKey)?.teams }));
  const [names, setNames] = useState<Record<number, string>>(() => loadMap(storeKey)?.names ?? {});
  const [copied, setCopied] = useState(false);
  const worker = useRef<Worker | null>(null);
  const media = useRef<MediaStream | null>(null);
  const video = useRef<{ el: HTMLVideoElement; timer: ReturnType<typeof setInterval>; url: string } | null>(null);
  const endedRef = useRef(false);
  const latest = useRef("");
  const lastSent = useRef("");

  // 확정 기록이 들어오면 다음 라운드를 새로 읽음
  if (played !== seen) {
    setSeen(played);
    if (played >= roundNo) {
      setRoundNo(played + 1);
      setSlots(emptySlots());
      setEnded(false);
    }
  }

  useEffect(() => {
    endedRef.current = ended;
  }, [ended]);

  useEffect(() => {
    localStorage.setItem(storeKey, JSON.stringify({ teams, names }));
  }, [storeKey, teams, names]);

  useEffect(() => {
    let version = initial.version;
    const t = setInterval(async () => {
      try {
        const next = await api.view(initial.code, version);
        if (next && next.version >= version) {
          version = next.version;
          setView(next);
        }
      } catch {}
    }, 10_000);
    return () => clearInterval(t);
  }, [initial.code, initial.version]);

  const body = useMemo(() => {
    if (!slots.some((s) => s.ts !== null || s.fixed)) return "";
    return JSON.stringify({
      roundNo,
      teams: slots.map((s) => ({
        slot: s.slot,
        teamId: teams[s.slot] || null,
        name: teams[s.slot] ? null : names[s.slot]?.trim() || null,
        ts: s.ts,
        ks: s.ks,
        out: s.out,
        place: s.place,
        fixed: s.fixed,
        color: s.color,
      })),
    });
  }, [roundNo, slots, teams, names]);

  useEffect(() => {
    latest.current = body;
  }, [body]);

  // 바뀐 값만 0.7초 간격으로 보냄. 서버는 조마다 초당 2회까지 받음
  useEffect(() => {
    let busy = false;
    const t = setInterval(async () => {
      const b = latest.current;
      if (busy || !b || b === lastSent.current) return;
      busy = true;
      try {
        const r = await fetch(`/api/live/${initial.code}/${segment}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: b, cache: "no-store" });
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.status !== 429) lastSent.current = b;
        setSent(r.ok ? { ok: true, text: `${clock.format(new Date())}에 점수를 오버레이에 반영했습니다.` } : { ok: false, text: d.error ?? "점수를 오버레이에 보내지 못했습니다." });
      } catch {
        setSent({ ok: false, text: "서버에 연결하지 못했습니다. 인터넷 연결을 확인해주세요." });
      } finally {
        busy = false;
      }
    }, 700);
    return () => clearInterval(t);
  }, [initial.code, segment]);

  useEffect(
    () => () => {
      media.current?.getTracks().forEach((t) => t.stop());
      if (video.current) clearInterval(video.current.timer);
      worker.current?.terminate();
    },
    [],
  );

  function ensureWorker(): Worker {
    if (worker.current) return worker.current;
    const w = new Worker(new URL("../lib/hud.worker.ts", import.meta.url), { type: "module" });
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === "cards") {
        setSize((s) => (s?.width === m.width && s.height === m.height ? s : { width: m.width, height: m.height }));
        if (!endedRef.current) setSlots((s) => applyRead(s, m.cards));
      } else if (m.type === "ended") stop();
      else setError(m.message);
    };
    worker.current = w;
    return w;
  }

  function stop() {
    media.current?.getTracks().forEach((t) => t.stop());
    media.current = null;
    if (video.current) {
      clearInterval(video.current.timer);
      video.current.el.pause();
      URL.revokeObjectURL(video.current.url);
      video.current = null;
    }
    setSource(null);
    setSize(null);
  }

  async function share() {
    setError(null);
    const P = (window as unknown as { MediaStreamTrackProcessor?: Processor }).MediaStreamTrackProcessor;
    if (!P || !navigator.mediaDevices?.getDisplayMedia) {
      setError("이 브라우저는 화면 읽기를 지원하지 않습니다. Chrome에서 열어주세요.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
    } catch {
      return;
    }
    stop();
    const track = stream.getVideoTracks()[0];
    media.current = stream;
    track.addEventListener("ended", stop);
    const proc = new P({ track });
    ensureWorker().postMessage({ type: "stream", readable: proc.readable, every: EVERY } satisfies WorkerIn, [proc.readable]);
    setSource("screen");
  }

  // 녹화 파일로 시험. 같은 값을 두 번 읽어야 반영되므로 사진은 두 번 보냄
  async function openFile(file: File) {
    setError(null);
    stop();
    const w = ensureWorker();
    if (file.type.startsWith("image/")) {
      for (let i = 0; i < 2; i++) {
        const bitmap = await createImageBitmap(file);
        w.postMessage({ type: "bitmap", bitmap } satisfies WorkerIn, [bitmap]);
      }
      setSource("image");
      return;
    }
    const el = document.createElement("video");
    const url = URL.createObjectURL(file);
    el.src = url;
    el.muted = true;
    el.playsInline = true;
    await el.play().catch(() => setError("영상을 재생하지 못했습니다."));
    const timer = setInterval(async () => {
      if (el.ended) return stop();
      if (el.readyState < 2) return;
      const bitmap = await createImageBitmap(el);
      w.postMessage({ type: "bitmap", bitmap } satisfies WorkerIn, [bitmap]);
    }, EVERY);
    video.current = { el, timer, url };
    setSource("video");
  }

  function edit(slot: number, field: "ts" | "ks", raw: string) {
    const v = raw.trim() === "" ? null : Number(raw.replace(",", "."));
    if (v !== null && !(Number.isFinite(v) && v >= 0 && v <= 99)) return;
    setSlots((s) => fixSlot(s, slot, { [field]: v === null ? null : Math.round(v * 10) / 10 }));
  }

  const g = view.groups[groupIdx];
  const title = `${view.name}${view.groupCount > 1 ? ` ${g.label}조` : ""}`;
  const overlayUrl = `${window.location.origin}/er/t/${view.code}/${segment}/live`;
  const wide = size && Math.abs(size.width / size.height - 16 / 9) > 0.02;
  const used = new Map(Object.entries(teams).filter(([, v]) => v).map(([k, v]) => [v, Number(k)]));

  return (
    <main id="main" className="wrap slim">
      <Link className="text-[13px] text-fg-3 no-underline" href={firstPath(view)}>
        대회 화면으로 돌아가기
      </Link>
      <h1 className="mt-1.5 mb-0.5 text-[28px] font-extrabold tracking-[-0.5px]">경기 중 점수 읽기</h1>
      <p className="mb-[18px] text-[14px] text-fg-3">
        {title}, {roundNo}라운드
      </p>

      <section className={BOX} aria-labelledby="src-h">
        <h2 className={H2} id="src-h">
          게임 화면
        </h2>
        <p className="mt-1.5 text-[13px] text-fg-3" role="status">
          {source
            ? `${source === "screen" ? "공유한 " : ""}${size ? `${size.width}x${size.height} ` : ""}${source === "screen" ? "화면" : source === "video" ? "녹화 영상" : "사진"}${ended ? "은 라운드가 끝나서 읽지 않습니다." : source === "image" ? "을 읽었습니다." : "을 1초마다 읽고 있습니다."}`
            : "공유한 화면이 없습니다."}
        </p>
        {wide && <p className="mt-1 text-[13px] text-minus">화면 비율이 16:9가 아니라 카드 위치가 맞지 않을 수 있습니다. 게임을 테두리 없는 창 모드로 바꿔주세요.</p>}
        {error && (
          <p className="mt-1 text-[13px] text-minus" role="alert">
            {error}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {source ? (
            <button type="button" className="btn" onClick={stop}>
              읽기 멈춤
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={share}>
              게임 화면 공유
            </button>
          )}
          <label className="btn">
            녹화 파일로 시험
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) openFile(f);
              }}
            />
          </label>
        </div>
      </section>

      <section className={BOX} aria-labelledby="cards-h">
        <h2 className={H2} id="cards-h">
          팀 카드
        </h2>
        <div className="mt-2.5" role="table" aria-label="팀 카드">
          <div className="lr-row lr-head" role="row">
            <span role="columnheader">카드</span>
            <span role="columnheader">팀</span>
            <span role="columnheader">TS</span>
            <span role="columnheader">KS</span>
            <span role="columnheader">상태</span>
          </div>
          {slots.map((s) => {
            const dup = teams[s.slot] && used.get(teams[s.slot]) !== s.slot;
            return (
              <div key={s.slot} className={`lr-row${s.warn ? " warn" : ""}${s.fixed ? " lr-fixed" : ""}`} role="row">
                <span className="tabular-nums" role="cell">
                  {String(s.slot).padStart(2, "0")}
                </span>
                <span className="min-w-0" role="cell">
                  <select
                    className={`field${dup ? " border-minus" : ""}`}
                    aria-label={`${s.slot}번 카드 팀`}
                    value={teams[s.slot] ?? ""}
                    onChange={(e) => setTeams((t) => ({ ...t, [s.slot]: e.target.value }))}
                  >
                    <option value="">{result.standings.length ? "연결 안 함" : "이름 직접 입력"}</option>
                    {result.standings.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {!teams[s.slot] && (
                    <input
                      className="field mt-1"
                      aria-label={`${s.slot}번 카드 팀 이름`}
                      placeholder={`${s.slot}번 팀`}
                      maxLength={24}
                      value={names[s.slot] ?? ""}
                      onChange={(e) => setNames((n) => ({ ...n, [s.slot]: e.target.value }))}
                    />
                  )}
                </span>
                {(["ts", "ks"] as const).map((f) => (
                  <span key={f} role="cell">
                    <input
                      key={`${roundNo}:${s[f]}`}
                      className="field text-right tabular-nums"
                      aria-label={`${s.slot}번 카드 ${f.toUpperCase()}`}
                      inputMode="decimal"
                      placeholder="-"
                      defaultValue={s[f] === null ? "" : num(s[f])}
                      onBlur={(e) => {
                        if (e.target.value !== (s[f] === null ? "" : num(s[f]))) edit(s.slot, f, e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                    />
                  </span>
                ))}
                <span role="cell">
                  <select
                    className="field"
                    aria-label={`${s.slot}번 카드 상태`}
                    value={s.out ? String(s.place ?? SLOTS) : "alive"}
                    onChange={(e) => setSlots((x) => fixSlot(x, s.slot, e.target.value === "alive" ? { out: false, place: null } : { out: true, place: Number(e.target.value) }))}
                  >
                    <option value="alive">{s.warn ? "확인 필요" : "생존"}</option>
                    {Array.from({ length: SLOTS - 1 }, (_, i) => SLOTS - i).map((p) => (
                      <option key={p} value={p}>
                        {p}위 탈락
                      </option>
                    ))}
                    <option value="1">1위</option>
                  </select>
                </span>
              </div>
            );
          })}
        </div>
        {sent && (
          <p className={`mt-2.5 text-[13px] ${sent.ok ? "text-fg-3" : "text-minus"}`} role={sent.ok ? "status" : "alert"}>
            {sent.text}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={!slots.some((s) => s.fixed)} onClick={() => setSlots(unfixAll)}>
            고친 값 해제
          </button>
          {ended ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setRoundNo((r) => Math.max(played + 1, r + 1));
                setSlots(emptySlots());
                setEnded(false);
              }}
            >
              다음 라운드 읽기
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setEnded(true)}>
              라운드 끝
            </button>
          )}
        </div>
      </section>

      <section className={BOX} aria-labelledby="ov-h">
        <h2 className={H2} id="ov-h">
          오버레이 주소
        </h2>
        <div className="mt-2.5 flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate text-[13px] text-fg-2" translate="no">
            {overlayUrl}
          </code>
          <button
            type="button"
            className="btn sm"
            onClick={async () => {
              await navigator.clipboard.writeText(overlayUrl);
              setCopied(true);
            }}
          >
            {copied ? "복사했습니다" : "주소 복사"}
          </button>
        </div>
      </section>
    </main>
  );
}
