"use client";

import { Fragment, useEffect, useState } from "react";
import { int } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { signed, WEAPON_SPRITE, type TierCombo, type TierView } from "@/er/lib/tier";

const GRADES: TierCombo["grade"][] = ["S", "A", "B", "C", "D"];

type Props = {
  views: TierView[];
  initial: string;
  fallback: string;
  updatedAt: number;
  patch: string | null;
  server: string;
  thin: number;
  publishRows: number;
  early?: { label: string; patch: string; rows: number };
  weights?: { gain: number; place: number; top3: number };
};

function Weapon({ code, label }: { code: number; label?: string }) {
  const i = WEAPON_SPRITE.indexOf(code);
  if (i < 0) return null;
  return <span className="tier-wg" style={{ ["--i" as string]: i }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}

const dayKo = (at: number) => new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(at);
const kstDay = (at: number) => Math.floor((at + 9 * 3_600_000) / 86_400_000);

function columns(grid: Element) {
  return getComputedStyle(grid).gridTemplateColumns.split(" ").length;
}

function Detail({ c, id }: { c: TierCombo; id: string }) {
  const range = c.half != null ? `${signed(c.score - c.half)} ~ ${signed(c.score + c.half)}` : null;
  return (
    <div className="tier-detail" id={id}>
      <p className="font-bold">
        {c.name} {c.weaponName}
      </p>
      <dl>
        {range && (
          <div>
            <dt>90% 범위</dt>
            <dd>{range}</dd>
          </div>
        )}
        <div>
          <dt>평균 순위</dt>
          <dd>{c.place.toFixed(2)}</dd>
        </div>
        <div>
          <dt>TOP3</dt>
          <dd>{c.top3.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>승률</dt>
          <dd>{c.win.toFixed(1)}%</dd>
        </div>
        <div>
          <dt>픽률</dt>
          <dd>{c.pick.toFixed(2)}%</dd>
        </div>
        <div>
          <dt>플레이어</dt>
          <dd>{int(c.players)}명</dd>
        </div>
      </dl>
    </div>
  );
}

export default function TierBoard(p: Props) {
  const [id, setId] = useState(p.initial);
  const [weapon, setWeapon] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [cols, setCols] = useState(1);
  const view = p.views.find((v) => v.id === id) ?? p.views[0];

  const pick = (next: string) => {
    setId(next);
    setOpen(null);
    if (weapon != null && !p.views.find((v) => v.id === next)?.combos.some((c) => c.weapon === weapon)) setWeapon(null);
    const url = new URL(window.location.href);
    if (next === p.fallback) url.searchParams.delete("v");
    else url.searchParams.set("v", next);
    window.history.replaceState(null, "", url);
  };

  useEffect(() => {
    if (!open) return;
    const measure = () => {
      const grid = document.querySelector('.tier-card[aria-expanded="true"]')?.parentElement;
      if (grid) setCols(columns(grid));
    };
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  const weapons = WEAPON_SPRITE.filter((code) => view.combos.some((c) => c.weapon === code)).map((code) => [code, view.combos.find((c) => c.weapon === code)!.weaponName] as const);
  const query = q.trim();
  const shown = view.combos.filter((c) => (weapon == null || c.weapon === weapon) && (!query || c.name.includes(query)));
  const w = p.weights;

  return (
    <>
      <div className="tier-head">
        <span className="tier-emblems" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/er/rank/Immortal.v1.png" alt="" width={75} height={96} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/er/rank/Titan.v1.png" alt="" width={75} height={96} />
        </span>
        <div className="min-w-0">
          <h1 className="text-[28px] font-extrabold tracking-[-0.5px]">실험체 티어</h1>
          <p className="text-[14px] text-fg-3 tabular-nums">
            {p.server} 상위 1,000명, {view.partial && `${dayKo(view.from)}부터 ${dayKo(view.to)}까지, `}
            {int(view.rows)}판, <span className="whitespace-nowrap">{timeKo(p.updatedAt)} 갱신</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="tabs" role="tablist" aria-label="기간">
          {p.views.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === view.id} onClick={() => pick(v.id)}>
              {v.id === `patch-${p.patch}` ? `${v.label} ${kstDay(p.updatedAt) - kstDay(v.from) + 1}일째` : v.label}
            </button>
          ))}
        </div>
        {p.early && (
          <p className="text-[14px] text-fg-2" role="status">
            {view.patch === p.early.patch
              ? `${p.early.label} 기록이 ${int(p.publishRows)}판보다 적어 등급이 크게 바뀔 수 있습니다. 지금 ${int(p.early.rows)}판입니다.`
              : `${p.early.label} 표는 ${int(p.publishRows)}판부터 기본으로 보여 줍니다. 지금 ${int(p.early.rows)}판입니다.`}
          </p>
        )}
        <div className="tier-ctl">
          <div className="tier-wf" role="group" aria-label="무기">
            {weapons.map(([code, name]) => (
              <button key={code} type="button" title={name} aria-label={name} aria-pressed={weapon === code} onClick={() => setWeapon(weapon === code ? null : code)}>
                <Weapon code={code} />
              </button>
            ))}
          </div>
          <input className="field sm tier-search" type="search" placeholder="실험체 검색" aria-label="실험체 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <details className="tier-how">
          <summary>계산 방법</summary>
          <p>
            점수는 평균보다 한 판에 RP를 얼마나 더 얻는지를 나타냅니다.
            <br />
            {w && (
              <>
                RP 획득 {w.gain * 100}%, 평균 순위 {w.place * 100}%, TOP3 비율 {w.top3 * 100}%를 합쳐 계산합니다.
                <br />
              </>
            )}
            판 수가 적은 조합은 점수를 그 실험체의 전체 점수에 가깝게 보정합니다.
            <br />
            {p.thin}판 미만인 조합은 흐리게 표시합니다.
          </p>
        </details>
      </div>

      {!shown.length && (
        <p className="panel px-5 py-4" role="status">
          맞는 조합이 없습니다.
          <br />
          무기나 검색어를 바꿔주세요.
        </p>
      )}
      {GRADES.map((g) => {
        const list = shown.filter((c) => c.grade === g);
        if (!list.length) return null;
        const at = list.findIndex((c) => `${c.char}:${c.weapon}` === open);
        const end = at < 0 ? -1 : Math.min(list.length, (Math.floor(at / cols) + 1) * cols) - 1;
        return (
          <section key={g} className="tier-board" aria-label={`${g} 등급`}>
            <div className="tier-gl">
              <span className="tier-grade" data-grade={g}>
                {g}
              </span>
            </div>
            <div className="tier-cards">
              {list.map((c, i) => {
                const key = `${c.char}:${c.weapon}`;
                const on = key === open;
                return (
                  <Fragment key={key}>
                    <button
                      type="button"
                      className="tier-card"
                      data-thin={c.n < p.thin || undefined}
                      aria-expanded={on}
                      aria-controls={on ? `tier-d-${g}` : undefined}
                      onClick={(e) => {
                        setCols(columns(e.currentTarget.parentElement!));
                        setOpen(on ? null : key);
                      }}
                    >
                      <span className="tier-pw">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={122} height={122} loading="lazy" />
                        <span className="tier-wb">
                          <Weapon code={c.weapon} />
                        </span>
                      </span>
                      <b>{c.name}</b>
                      <small>{c.weaponName}</small>
                      <span className="tier-sc">{signed(c.score)}</span>
                      <small>{int(c.n)}판</small>
                    </button>
                    {i === end && <Detail c={list[at]} id={`tier-d-${g}`} />}
                  </Fragment>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
