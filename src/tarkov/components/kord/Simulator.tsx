"use client";

import { useEffect, useMemo, useState } from "react";
import { COMMON, PERK as BY_ID, PERSONAL, decodeBuild as decode, encodeBuild as encode, type Perk, type Preset } from "@/tarkov/lib/kord";

const POSITIVE = PERSONAL.filter((p) => (p.points ?? 0) < 0).sort((a, b) => b.points! - a.points!);
const NEGATIVE = PERSONAL.filter((p) => (p.points ?? 0) > 0).sort((a, b) => a.points! - b.points!);

// 데이터에 한쪽만 적힌 배타 관계도 양쪽으로 맞춤
const EXCLUSIVE = (() => {
  const m = new Map<string, Set<string>>();
  for (const p of PERSONAL) {
    for (const x of p.exclusive ?? []) {
      if (!BY_ID.has(x)) continue;
      if (!m.has(p.id)) m.set(p.id, new Set());
      if (!m.has(x)) m.set(x, new Set());
      m.get(p.id)!.add(x);
      m.get(x)!.add(p.id);
    }
  }
  return m;
})();

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

function Icon({ id }: { id: string }) {
  const url = `url(/kord/perks/${id}.png)`;
  return <span className="kb-icon" style={{ WebkitMaskImage: url, maskImage: url }} aria-hidden="true" />;
}

function Card({ p, on, blockedBy, onToggle }: { p: Perk; on: boolean; blockedBy: string[]; onToggle: () => void }) {
  const kind = p.points! < 0 ? "pos" : "neg";
  const blocked = blockedBy.length > 0;
  return (
    <li>
      <button
        type="button"
        className={`kb-card ${kind}`}
        aria-pressed={on}
        aria-disabled={blocked || undefined}
        onClick={() => {
          if (!blocked) onToggle();
        }}
      >
        <Icon id={p.id} />
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
          {blocked && <span className="kb-why">함께 고를 수 없음: {blockedBy.map((id) => BY_ID.get(id)!.name).join(", ")}</span>}
        </span>
      </button>
    </li>
  );
}

export default function Simulator({ presets }: { presets: Preset[] }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState("");
  const [undo, setUndo] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    const raw = new URLSearchParams(location.search).get("b");
    if (!raw) return;
    const ids = decode(raw);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소의 빌드는 브라우저에서만 읽을 수 있음
    if (ids.length) setSel(new Set(ids));
  }, []);

  useEffect(() => {
    const url = new URL(location.href);
    if (sel.size) url.searchParams.set("b", encode(sel));
    else url.searchParams.delete("b");
    history.replaceState(null, "", url);
  }, [sel]);

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
    const m = new Map<string, string[]>();
    for (const id of sel) for (const x of EXCLUSIVE.get(id) ?? []) if (!sel.has(x)) m.set(x, [...(m.get(x) ?? []), id]);
    return m;
  }, [sel]);

  const chosen = [...sel].map((id) => BY_ID.get(id)!);
  const spent = chosen.filter((p) => p.points! < 0).reduce((a, p) => a + p.points!, 0);
  const earned = chosen.filter((p) => p.points! > 0).reduce((a, p) => a + p.points!, 0);
  const left = earned + spent;

  const list = (perks: Perk[]) => (
    <ul className="kb-list">
      {perks.map((p) => (
        <Card key={p.id} p={p} on={sel.has(p.id)} blockedBy={blockers.get(p.id) ?? []} onToggle={() => toggle(p.id)} />
      ))}
    </ul>
  );

  return (
    <div className="kord">
      <div className="kb-bar">
        <div role="status" aria-live="polite">
          <dl className="kb-sum">
            <div>
              <dt>얻은 포인트</dt>
              <dd className="num">{earned}</dd>
            </div>
            <div>
              <dt>쓴 포인트</dt>
              <dd className="num">{-spent}</dd>
            </div>
            <div className={left < 0 ? "kb-left bad" : "kb-left"}>
              <dt>남은 포인트</dt>
              <dd className="num">{left}</dd>
            </div>
          </dl>
        </div>
        {left < 0 && <span className="kb-warn">포인트가 {-left} 부족합니다</span>}
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
          {list(POSITIVE)}
        </section>
        <section aria-labelledby="kb-neg">
          <h2 id="kb-neg" className="kb-h">
            부정 특성 <span className="muted">포인트를 얻음</span>
          </h2>
          {list(NEGATIVE)}
        </section>
      </div>

      <section aria-labelledby="kb-common">
        <h2 id="kb-common" className="kb-h">
          시즌 공통 특성 <span className="muted">모든 계정에 적용</span>
        </h2>
        <ul className="kb-list grid3">
          {COMMON.map((p) => (
            <li key={p.id} className="kb-card">
              <Icon id={p.id} />
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
