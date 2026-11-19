"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeBuild, encodeBuild, type Perk, type Season } from "@/tarkov/lib/build";
import type { Preset } from "@/tarkov/lib/kord";

// 데이터에 한쪽만 적힌 배타 관계도 양쪽으로 맞춤
function exclusive(perks: Map<string, Perk>) {
  const m = new Map<string, Set<string>>();
  for (const p of perks.values()) {
    for (const x of p.exclusive ?? []) {
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

function Icon({ id }: { id: string }) {
  const url = `url(/kord/perks/${id}.png)`;
  return <span className="kb-icon" style={{ WebkitMaskImage: url, maskImage: url }} aria-hidden="true" />;
}

function Card({ p, on, blockedBy, onToggle }: { p: Perk; on: boolean; blockedBy: Perk[]; onToggle: () => void }) {
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
          {blocked && <span className="kb-why">함께 고를 수 없음: {blockedBy.map((b) => b.name).join(", ")}</span>}
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
  const [copied, setCopied] = useState("");
  const [undo, setUndo] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 6000);
    return () => clearTimeout(t);
  }, [undo]);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const other = q.get("s");
    if (other && other !== season.slug && paths[other]) {
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
    for (const id of sel) for (const x of excl.get(id) ?? []) if (!sel.has(x)) m.set(x, [...(m.get(x) ?? []), byId.get(id)!]);
    return m;
  }, [sel, excl, byId]);

  const chosen = [...sel].map((id) => byId.get(id)!);
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
