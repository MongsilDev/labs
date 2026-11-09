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
  seasonEnd: number;
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

function Arrow() {
  return (
    <>
      <svg className="tier-arr" viewBox="0 0 12 12" width="12" height="12" aria-hidden>
        <path d="M2 6h7M6 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">에서</span>
    </>
  );
}

type Moved = { c: TierCombo; o: TierCombo };

function MovedList({ title, list }: { title: string; list: Moved[] }) {
  if (!list.length) return null;
  return (
    <>
      <h3>
        {title} {list.length}
      </h3>
      <ul>
        {list.map(({ c, o }) => (
          <li key={`${c.char}:${c.weapon}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={28} height={28} loading="lazy" />
            <span className="truncate">
              {c.name} {c.weaponName}
            </span>
            <span className="tier-mv">
              <span className="tier-grade sm" data-grade={o.grade}>
                {o.grade}
              </span>
              <Arrow />
              <span className="tier-grade sm" data-grade={c.grade}>
                {c.grade}
              </span>
            </span>
            <span className="tier-mv">
              {signed(o.score)}
              <Arrow />
              {signed(c.score)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
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
        {c.lead3 != null && (
          <div>
            <dt>많이 한 3명</dt>
            <dd>판의 {c.lead3}%</dd>
          </div>
        )}
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
  // 지금 패치 탭에서만 직전 패치와 비교. 점수 차이의 90% 범위에 0이 들어가지 않는 조합
  const prev = view.id === `patch-${p.patch}` && !view.season ? p.views.find((v) => v.id.startsWith("patch-") && v.id !== view.id && !v.season) : undefined;
  const moved: Moved[] = prev
    ? shown
        .flatMap((c) => {
          const o = prev.combos.find((x) => x.char === c.char && x.weapon === c.weapon);
          return o && c.half != null && o.half != null && Math.abs(c.score - o.score) > Math.hypot(c.half, o.half) ? [{ c, o }] : [];
        })
        .sort((a, b) => b.c.score - b.o.score - (a.c.score - a.o.score))
    : [];

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
            {p.server} 상위 1,000명, {view.season && `${view.season}, `}
            {view.partial && `${dayKo(view.from)}부터 ${dayKo(view.to)}까지, `}
            {view.patches && `${view.patches[0]}~${view.patches.at(-1)} 패치, `}
            {int(view.rows)}판, <span className="whitespace-nowrap">{view.season ? `${dayKo(view.to)} 경기까지` : `${timeKo(p.updatedAt)} 갱신`}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div className="tabs" role="tablist" aria-label="기간">
          {p.views.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === view.id} onClick={() => pick(v.id)}>
              {v.id === `patch-${p.patch}` && !v.season ? `${v.label} ${kstDay(Math.min(p.updatedAt, p.seasonEnd)) - kstDay(v.from) + 1}일째` : v.label}
            </button>
          ))}
        </div>
        {p.early && view.patch === p.early.patch && !view.patches && !view.season ? (
          <p className="text-[14px] text-fg-2" role="status">
            {p.early.label} 기록이 {int(p.publishRows)}판보다 적어 등급이 크게 바뀔 수 있습니다. 지금 {int(p.early.rows)}판입니다.
          </p>
        ) : (
          // 새 시즌 첫 패치는 판 수와 상관없이 기본이라 이 안내가 없음
          p.early &&
          p.fallback !== `patch-${p.early.patch}` && (
            <p className="text-[14px] text-fg-2" role="status">
              {p.early.label} 표는 {int(p.publishRows)}판부터 기본으로 보여 줍니다. 지금 {int(p.early.rows)}판입니다.
            </p>
          )
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
            {prev && (
              <>
                <br />
                패치 비교에는 점수 차이의 90% 범위에 0이 들어가지 않는 조합만 넣습니다.
              </>
            )}
          </p>
        </details>
        {prev && moved.length > 0 && (
          <details className="tier-how tier-moved">
            <summary>
              {prev.patch} 패치보다 크게 바뀐 조합 {moved.length}개
            </summary>
            <MovedList title="오른 조합" list={moved.filter((m) => m.c.score > m.o.score)} />
            <MovedList title="내린 조합" list={moved.filter((m) => m.c.score < m.o.score)} />
          </details>
        )}
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
                        {/* 새 실험체는 초상 파일을 더하기 전까지 칸만 남김 */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={122} height={122} loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
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
