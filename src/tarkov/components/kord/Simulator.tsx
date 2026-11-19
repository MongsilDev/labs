"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { decodeBuild, encodeBuild, type Perk, type Season } from "@/tarkov/lib/build";
import type { Preset } from "@/tarkov/lib/kord";

// 데이터에 한쪽만 적힌 배타 관계도 양쪽으로 맞춤
function exclusive(perks: Map<string, Perk>) {
  const m = new Map<string, Set<string>>();
  for (const p of perks.values()) {
    for (const x of [...(p.exclusive ?? []), ...(p.guess ?? [])]) {
      if (!perks.has(x)) continue;
      if (!m.has(p.id)) m.set(p.id, new Set());
      if (!m.has(x)) m.set(x, new Set());
      m.get(p.id)!.add(x);
      m.get(x)!.add(p.id);
    }
  }
  return m;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Icon({ p }: { p: Perk }) {
  // 공식 데이터가 나오기 전 특성은 아이콘이 없어 같은 크기의 빈 자리만 둠
  if (p.icon === false) return <span className="kb-icon none" aria-hidden="true" />;
  const url = `url(/kord/perks/${p.id}.png)`;
  return <span className="kb-icon" style={{ WebkitMaskImage: url, maskImage: url }} aria-hidden="true" />;
}

// 고른 카드의 blockedBy는 규칙이 생기기 전 빌드 주소로 함께 골라진 특성. 뺄 수 있게 막지 않음
function Card({ p, on, blockedBy, onToggle }: { p: Perk; on: boolean; blockedBy: Perk[]; onToggle: () => void }) {
  const kind = p.points! < 0 ? "pos" : "neg";
  const blocked = !on && blockedBy.length > 0;
  return (
    <li>
      <button
        type="button"
        className={`kb-card ${kind}`}
        data-id={p.id}
        aria-pressed={on}
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (!blocked) onToggle();
        }}
      >
        <Icon p={p} />
        <span className="kb-body">
          <span className="kb-top">
            <b className="kb-name">{p.name}</b>
            <span className="kb-pts num">{signed(p.points!)}</span>
          </span>
          {p.effects.map((e) => (
            <span key={e} className="kb-eff">
              {e}
            </span>
          ))}
          {blockedBy.length > 0 && <span className={on ? "kb-why bad" : "kb-why"}>함께 고를 수 없음: {blockedBy.map((b) => b.name).join(", ")}</span>}
        </span>
      </button>
    </li>
  );
}

// paths는 다른 시즌 주소. 주소의 s가 이 화면과 다른 시즌이면 그 시즌 화면으로 넘김
export default function Simulator({ season, presets, paths }: { season: Season; presets: Preset[]; paths: Record<string, string> }) {
  const { byId, positive, negative, excl } = useMemo(() => {
    const byId = new Map(season.personal.map((p) => [p.id, p]));
    return {
      byId,
      positive: season.personal.filter((p) => (p.points ?? 0) < 0).sort((a, b) => b.points! - a.points!),
      negative: season.personal.filter((p) => (p.points ?? 0) > 0).sort((a, b) => a.points! - b.points!),
      excl: exclusive(byId),
    };
  }, [season]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  // 다른 시즌 화면으로 넘기는 동안 주소를 고치면 이동이 취소될 수 있음
  const leaving = useRef(false);
  const [copied, setCopied] = useState("");
  const [undo, setUndo] = useState<Set<string> | null>(null);
  // 휴대폰 폭에서 한 줄 요약을 눌러 펼친 상태
  const [open, setOpen] = useState(false);
  // 넓은 화면에서 막대 한 줄에 들어가는 칩 수. 고른 특성이나 창 폭이 바뀌면 다시 잼
  const [measured, setMeasured] = useState<{ key: string; n: number } | null>(null);
  const [resized, setResized] = useState(0);
  const chipsRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const other = q.get("s");
    if (other && other !== season.slug && paths[other]) {
      leaving.current = true;
      location.replace(`${paths[other]}${location.search}`);
      return;
    }
    const raw = q.get("b");
    if (!raw) return;
    const ids = decodeBuild(season, raw);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소의 빌드는 브라우저에서만 읽을 수 있음
    if (ids.length) setSel(new Set(ids));
  }, [season, paths]);

  useEffect(() => {
    if (leaving.current) return;
    const url = new URL(location.href);
    if (sel.size) {
      url.searchParams.set("s", season.slug);
      url.searchParams.set("b", encodeBuild(season, sel));
    } else {
      url.searchParams.delete("s");
      url.searchParams.delete("b");
    }
    history.replaceState(null, "", url);
  }, [sel, season]);

  const toggle = (id: string) => {
    setUndo(null);
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const blockers = useMemo(() => {
    const m = new Map<string, Perk[]>();
    for (const id of sel) for (const x of excl.get(id) ?? []) m.set(x, [...(m.get(x) ?? []), byId.get(id)!]);
    return m;
  }, [sel, excl, byId]);
  const clash = [...sel].some((id) => blockers.has(id));

  const chosen = [...sel].map((id) => byId.get(id)!);
  const spent = chosen.filter((p) => p.points! < 0).reduce((a, p) => a + p.points!, 0);
  const earned = chosen.filter((p) => p.points! > 0).reduce((a, p) => a + p.points!, 0);
  const left = earned + spent;
  const picked = [...positive, ...negative].filter((p) => sel.has(p.id));
  const warn = clash ? "함께 고를 수 없는 특성 중 하나를 빼야 합니다" : left < 0 ? "부정 특성을 더 골라야 합니다" : "";
  // 뺀 칩이 사라져도 키보드 초점이 이웃 칩이나 같은 특성 카드에 남게 함
  const drop = (el: HTMLElement, id: string, kbd: boolean) => {
    const li = el.closest("li");
    const next = li?.nextElementSibling?.querySelector("button");
    const prev = li?.previousElementSibling?.querySelector("button");
    const card = document.querySelector<HTMLElement>(`.kb-card[data-id="${id}"]`);
    toggle(id);
    requestAnimationFrame(() => {
      const near = [next, prev, document.querySelector<HTMLElement>(".kb-more")].find((b) => b?.offsetParent);
      // 포인터로 눌렀을 때 카드 위치로 화면이 튀지 않게 함
      if (near) near.focus();
      else card?.focus({ preventScroll: !kbd });
    });
  };
  const fitKey = `${picked.map((p) => p.id).join()}|${resized}`;
  const fit = !open && measured?.key === fitKey ? measured.n : null;
  useLayoutEffect(() => {
    if (fit !== null || open || !chipsRef.current) return;
    const items = [...chipsRef.current.children] as HTMLElement[];
    setMeasured({ key: fitKey, n: items.filter((li) => li.offsetTop === items[0].offsetTop).length });
  }, [fit, open, fitKey]);
  // 칩 자리 폭은 창 폭뿐 아니라 옆 버튼 문구에 따라서도 바뀜
  const hasChips = picked.length > 0;
  useEffect(() => {
    const box = chipsRef.current?.parentElement;
    if (!box) return;
    const reset = () => setResized((n) => n + 1);
    // 잴 때 칩이 여러 줄로 늘어나 높이가 바뀌므로 폭이 바뀔 때만 다시 잼
    let w = box.clientWidth;
    const ro = new ResizeObserver(() => {
      if (box.clientWidth === w) return;
      w = box.clientWidth;
      reset();
    });
    ro.observe(box);
    document.fonts?.ready.then(reset);
    return () => ro.disconnect();
  }, [hasChips]);

  const list = (perks: Perk[]) => (
    <ul className="kb-list">
      {perks.map((p) => (
        <Card key={p.id} p={p} on={sel.has(p.id)} blockedBy={blockers.get(p.id) ?? []} onToggle={() => toggle(p.id)} />
      ))}
    </ul>
  );

  return (
    <div className="kord">
      <div className={open ? "kb-bar open" : "kb-bar"}>
        <span className="kb-live" role="status" aria-live="polite">
          남은 포인트 {left}
        </span>
        <button type="button" className="kb-pill" aria-expanded={open} aria-controls="kb-panel" onClick={() => setOpen((o) => !o)}>
          <span>
            남은 포인트 <b className={left < 0 ? "num bad" : "num"}>{left}</b>
          </span>
          {warn ? <span className="kb-pill-sub bad">{warn}</span> : sel.size > 0 && <span className="kb-pill-sub">{sel.size}개 고름</span>}
        </button>
        <div id="kb-panel" className="kb-panel">
          <div className={left < 0 ? "kb-left bad" : "kb-left"}>
            <span>남은 포인트</span>
            <b className="num">{left}</b>
          </div>
          <div className="kb-meter">
            <span className="kb-track" aria-hidden="true">
              <i className="pos" style={{ flexGrow: -spent }} />
              <i className="neg" style={{ flexGrow: earned }} />
            </span>
            <span className="kb-legend">
              <span className="pos">
                쓴 포인트 <b className="num">{-spent}</b>
              </span>
              <span className="neg">
                얻은 포인트 <b className="num">{earned}</b>
              </span>
            </span>
          </div>
          {warn && <span className="kb-warn">{warn}</span>}
          {picked.length > 0 && (
            <div className="kb-picked">
              <ul ref={chipsRef} className="kb-chips" aria-label="고른 특성">
                {picked.map((p, i) => (
                  <li key={p.id} hidden={!open && fit !== null && i >= fit}>
                    <button type="button" className={`kb-chip ${p.points! < 0 ? "pos" : "neg"}`} aria-label={`${p.name} 빼기`} onClick={(e) => drop(e.currentTarget, p.id, e.detail === 0)}>
                      {p.name}
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
              {(open || fit === null || fit < picked.length) && (
                <button type="button" className="kb-more" aria-expanded={open} aria-controls="kb-panel" onClick={() => setOpen((o) => !o)}>
                  {open ? "접기" : `+${picked.length - (fit ?? 0)}`}
                </button>
              )}
            </div>
          )}
          <div className="kb-acts">
            <button
              type="button"
              className="btn sm"
              disabled={!sel.size}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(location.href);
                  setCopied("주소를 복사했습니다");
                } catch {
                  setCopied("주소를 복사하지 못했습니다");
                }
                setTimeout(() => setCopied(""), 2000);
              }}
            >
              {copied || "빌드 주소 복사"}
            </button>
            {undo ? (
              <button
                type="button"
                className="btn sm"
                onClick={() => {
                  setSel(undo);
                  setUndo(null);
                }}
              >
                되돌리기
              </button>
            ) : (
              <button
                type="button"
                className="btn sm"
                disabled={!sel.size}
                onClick={() => {
                  setUndo(sel);
                  setSel(new Set());
                }}
              >
                초기화
              </button>
            )}
          </div>
        </div>
      </div>

      {presets.length > 0 && (
        <section aria-labelledby="kb-ach">
          <h2 id="kb-ach" className="kb-h">
            업적 조건
          </h2>
          <div className="kb-presets">
            {presets.map((p) => (
              <button
                key={p.name}
                type="button"
                className="btn sm"
                onClick={() => {
                  setUndo(sel.size ? sel : null);
                  setSel(new Set(p.ids));
                  // 휴대폰 폭에서는 되돌리기가 접힌 요약 안에 있음
                  if (sel.size && matchMedia("(max-width: 560px)").matches) setOpen(true);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="kb-cols">
        <section aria-labelledby="kb-pos">
          <h2 id="kb-pos" className="kb-h">
            긍정 특성 <span className="muted">포인트를 씀</span>
          </h2>
          {list(positive)}
        </section>
        <section aria-labelledby="kb-neg">
          <h2 id="kb-neg" className="kb-h">
            부정 특성 <span className="muted">포인트를 얻음</span>
          </h2>
          {list(negative)}
        </section>
      </div>

      <section aria-labelledby="kb-common">
        <h2 id="kb-common" className="kb-h">
          시즌 공통 특성 <span className="muted">모든 계정에 적용</span>
        </h2>
        <ul className="kb-list grid3">
          {season.common.map((p) => (
            <li key={p.id} className="kb-card">
              <Icon p={p} />
              <span className="kb-body">
                <b className="kb-name">{p.name}</b>
                {p.effects.map((e) => (
                  <span key={e} className="kb-eff">
                    {e}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
