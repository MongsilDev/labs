"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { date } from "@/tarkov/lib/format";
import { tarkovDevSearchUrl, type Mode } from "@/tarkov/lib/modes";
import Lines from "@/components/Lines";

type Hit = { aid: number; name: string; last: number | null };

const NOT_FOUND = "찾는 닉네임이 없습니다. tarkov.dev 프로필 주소 끝의 계정 번호로 찾아주세요.";

export default function SearchBox({ autoFocus, compact, initial, mode }: { autoFocus?: boolean; compact?: boolean; initial?: string; mode?: Mode }) {
  const router = useRouter();
  const [q, setQ] = useState(initial ?? "");
  // 첫 화면 검색창에서 전달된 검색어는 결과가 오면 한 번 제출
  const pending = useRef(Boolean(initial?.trim()));
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const searched = useRef("");
  const failed = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  // 휴대폰에서는 키보드가 화면을 가리지 않게 자동 초점을 주지 않음
  useEffect(() => {
    if (autoFocus && matchMedia("(pointer: fine)").matches) input.current?.focus();
  }, [autoFocus]);
  const listId = useId();

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2 && !/^\d+$/.test(t)) {
      seq.current++;
      return;
    }
    const n = ++seq.current;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(t)}`);
        const data = (await r.json()) as { results?: Hit[]; error?: string };
        if (n !== seq.current) return;
        searched.current = t;
        failed.current = Boolean(data.error);
        setHits(data.results ?? []);
        setActive(-1);
        setOpen(true);
        setMsg(data.error ?? "");
        if (pending.current) {
          pending.current = false;
          const low = t.toLowerCase();
          const list = data.results ?? [];
          const pick = list.find((h) => h.name.toLowerCase() === low || String(h.aid) === low) ?? (list.length === 1 ? list[0] : null);
          const aid = pick?.aid ?? (!list.length && /^\d{1,10}$/.test(low) ? Number(low) : 0);
          if (aid) {
            setOpen(false);
            setBusy(true);
            router.push(`/tarkov/players/${aid}`);
          } else if (!list.length && !data.error) setMsg(NOT_FOUND);
        }
      } catch {
        if (n !== seq.current) return;
        // 검색이 실패해도 계정 번호는 바로 열리게 실패한 검색어도 끝난 것으로 둠
        searched.current = t;
        failed.current = true;
        setHits([]);
        const aid = pending.current && /^\d{1,10}$/.test(t) ? Number(t) : 0;
        pending.current = false;
        if (aid) {
          setBusy(true);
          router.push(`/tarkov/players/${aid}`);
        } else setMsg("검색하지 못했습니다.");
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [q, router]);

  const go = (h: Hit) => {
    pending.current = false;
    setOpen(false);
    setBusy(true);
    router.push(`/tarkov/players/${h.aid}`);
  };

  const submit = () => {
    const t = q.trim().toLowerCase();
    if (!t) return;
    // 목록에서 고른 후보는 결과를 기다리지 않고 바로 열림
    if (active >= 0 && hits[active]) {
      go(hits[active]);
      return;
    }
    if (t.length < 2 && !/^\d+$/.test(t)) {
      setMsg("두 글자 이상 입력해주세요.");
      return;
    }
    // 지금 검색어의 결과가 오기 전이면 결과가 온 뒤 한 번 제출
    if (searched.current !== q.trim()) {
      pending.current = true;
      return;
    }
    const pick = hits.find((h) => h.name.toLowerCase() === t || String(h.aid) === t) ?? (hits.length === 1 ? hits[0] : null);
    if (pick) go(pick);
    else if (hits.length) setOpen(true);
    // 닉네임 목록에 아직 없는 새 계정도 계정 번호로는 바로 열림
    else if (/^\d{1,10}$/.test(t)) go({ aid: Number(t), name: t, last: null });
    // 검색이 실패한 검색어는 실패 안내를 그대로 둠
    else if (!failed.current) setMsg(NOT_FOUND);
  };

  const shown = open && q.trim().length > 0;

  return (
    <div className={`search${compact ? " compact" : ""}`}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="field"
          type="search"
          placeholder="닉네임 또는 계정 번호"
          aria-label="닉네임 또는 계정 번호"
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          ref={input}
          name="q"
          value={q}
          role="combobox"
          aria-expanded={shown && hits.length > 0}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            setQ(e.target.value);
            setMsg("");
            searched.current = "";
            pending.current = false;
            if (!e.target.value.trim()) setHits([]);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(hits.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
        />
        <button className="btn primary" type="submit" disabled={busy}>
          조회
        </button>
      </form>
      {shown && hits.length > 0 && (
        <ul className="panel hits" id={listId} role="listbox">
          {hits.map((h, i) => (
            <li
              key={h.aid}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
            >
              <b className="ellipsis" translate="no">{h.name}</b>
              <span className="muted small num">#{h.aid}</span>
              {h.last && <span className="muted small num hit-date">{date(h.last)}</span>}
            </li>
          ))}
          <li className="hits-note" role="presentation" aria-hidden="true">
            날짜는 tarkov.dev 기록이 마지막으로 갱신된 날입니다.
          </li>
        </ul>
      )}
      {msg && (
        <p className="err" role="status">
          <Lines text={msg} />
          {msg === NOT_FOUND && (
            <>
              <br />
              <a className="link" href={tarkovDevSearchUrl(mode)} target="_blank" rel="noreferrer">
                tarkov.dev 플레이어 검색
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
