"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { int } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { BADGE, signed, WEAPON_SPRITE, type TierCombo, type TierSplit, type TierView } from "@/er/lib/tier";

const GRADES: TierCombo["grade"][] = ["S", "A", "B", "C", "D"];
const ROLES = ["탱커", "전사", "암살자", "스킬 딜러", "원거리 딜러", "지원가"];

type Props = {
  views: TierView[];
  initial: string;
  fallback: string;
  updatedAt: number;
  seasonEnd: number;
  patch: string | null;
  server: string;
  thin: number;
  few?: number;
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
              {c.weaponName} {c.name}
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

function Rp({ g }: { g: number | null }) {
  if (g == null) return <td className="g">-</td>;
  return <td className={g > 0 ? "g up" : g < 0 ? "g down" : "g"}>{signed(g)}</td>;
}

function Head({ first }: { first: string }) {
  return (
    <thead>
      <tr>
        <th scope="col">{first}</th>
        <th scope="col" className="p">
          플레이어
        </th>
        <th scope="col" className="n">
          판
        </th>
        <th scope="col" className="r">
          비율
        </th>
        <th scope="col" className="g">
          RP 획득
        </th>
      </tr>
    </thead>
  );
}

function Split({ title, first, list, dn }: { title: string; first: string; list: TierSplit[]; dn: number }) {
  if (!list.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <table>
        <Head first={first} />
        <tbody>
          {list.map(([name, players, n, g]) => (
            <tr key={name}>
              <td className="nm">{name}</td>
              <td className="p">{int(players)}명</td>
              <td className="n">{int(n)}</td>
              <td className="r">{((n / dn) * 100).toFixed(1)}%</td>
              <Rp g={g} />
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <rect x="5" y="5" width="9" height="9" rx="2" />
    <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M3 8.5l3.2 3L13 4.5" />
  </svg>
);

function Drawer({ c, onClose }: { c: TierCombo; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<number | null>(null);

  // 조합을 바꾸면 key가 바뀌어 다시 마운트되므로 열릴 때마다 닫기 버튼으로 초점을 옮김
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.documentElement.classList.add("tier-dx-open");
    window.addEventListener("keydown", esc);
    return () => {
      document.documentElement.classList.remove("tier-dx-open");
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  useEffect(() => {
    if (copied == null) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (id: number) => {
    try {
      await navigator.clipboard.writeText(String(id));
      setCopied(id);
    } catch {
      setCopied(null);
    }
  };

  const range = c.half != null ? `${signed(c.score - c.half)} ~ ${signed(c.score + c.half)}` : null;
  const dn = c.dn ?? 0;
  const routes = c.routes ?? [];
  return (
    <aside id="tier-dx" className="tier-dx" role="dialog" aria-labelledby="tier-dx-h">
      <header className="tier-dx-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={56} height={56} onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        <h2 id="tier-dx-h">
          {c.weaponName} {c.name}
        </h2>
        <span className="tier-grade sm" data-grade={c.grade}>
          {c.grade}
        </span>
        <button ref={closeRef} type="button" className="tier-dx-x" aria-label="닫기" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" />
          </svg>
        </button>
      </header>
      <div className="tier-dx-body">
        <dl className="tier-dx-tiles">
          <div>
            <dt>점수</dt>
            <dd>
              {signed(c.score)}
              {range && <small>90% 범위 {range}</small>}
            </dd>
          </div>
          <div>
            <dt>판</dt>
            <dd>
              {int(c.n)}
              <small>플레이어 {int(c.players)}명</small>
            </dd>
          </div>
          <div>
            <dt>평균 순위</dt>
            <dd>{c.place.toFixed(2)}</dd>
          </div>
          <div>
            <dt>TOP 3</dt>
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
        </dl>
        {dn > 0 && routes.length > 0 && (
          <section>
            <h3>루트</h3>
            <table>
              <Head first="번호" />
              <tbody>
                {routes.map(([id, players, n, g, b]) => (
                  <tr key={id}>
                    <td>
                      <button type="button" className="tier-dx-copy" aria-label={`루트 번호 ${id} 복사`} onClick={() => copy(id)}>
                        {id}
                        {copied === id ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      {b && (
                        <span className="tier-dx-b" data-b={b}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={BADGE[b].img} alt="" width={14} height={16} />
                          {BADGE[b].label}
                        </span>
                      )}
                    </td>
                    <td className="p">{int(players)}명</td>
                    <td className="n">{int(n)}</td>
                    <td className="r">{((n / dn) * 100).toFixed(1)}%</td>
                    <Rp g={g} />
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
        {dn > 0 && <Split title="특성" first="핵심 특성" list={c.traits ?? []} dn={dn} />}
        {dn > 0 && <Split title="전술 스킬" first="전술 스킬" list={c.tac ?? []} dn={dn} />}
        <p className="sr-only" aria-live="polite">
          {copied != null ? "루트 번호를 복사했습니다." : ""}
        </p>
      </div>
    </aside>
  );
}

export default function TierBoard(p: Props) {
  const [id, setId] = useState(p.initial);
  const [role, setRole] = useState<string | null>(null);
  const [sort, setSort] = useState<"score" | "pick">("score");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const view = p.views.find((v) => v.id === id) ?? p.views[0];
  const sel = open ? view.combos.find((c) => `${c.char}:${c.weapon}` === open) : undefined;
  const close = useCallback(() => {
    setOpen(null);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  const pick = (next: string) => {
    setId(next);
    setOpen(null);
    if (role != null && !p.views.find((v) => v.id === next)?.combos.some((c) => c.roles?.includes(role))) setRole(null);
    const url = new URL(window.location.href);
    if (next === p.fallback) url.searchParams.delete("v");
    else url.searchParams.set("v", next);
    window.history.replaceState(null, "", url);
  };

  const roles = [...ROLES, ...new Set(view.combos.flatMap((c) => c.roles ?? []))].filter((r, i, a) => a.indexOf(r) === i && view.combos.some((c) => c.roles?.includes(r)));
  // 「석궁 나딘」과 「나딘 석궁」 모두 찾음
  const query = q.replace(/\s+/g, "");
  const shown = view.combos.filter(
    (c) => (role == null || c.roles?.includes(role)) && (!query || `${c.weaponName}${c.name}`.replace(/\s+/g, "").includes(query) || `${c.name}${c.weaponName}`.replace(/\s+/g, "").includes(query)),
  );
  const groups: [string, TierCombo[]][] = sort === "pick" ? [["pick", [...shown].sort((a, b) => b.pick - a.pick || b.n - a.n)]] : GRADES.map((g) => [g, shown.filter((c) => c.grade === g)]);
  const w = p.weights;
  // 지금 패치 탭에서만 직전 패치와 비교. 점수 차이의 90% 범위에 0이 들어가지 않는 조합
  const prev = view.id === `patch-${p.patch}` && !view.season ? p.views.find((v) => v.id.startsWith("patch-") && v.id !== view.id && !v.season) : undefined;
  const moved: Moved[] = prev
    ? shown
        .flatMap((c) => {
          const o = prev.combos.find((x) => x.char === c.char && x.weapon === c.weapon);
          return o && c.half != null && o.half != null && Math.abs(c.score - o.score) > Math.hypot(c.half, o.half) ? [{ c, o }] : [];
        })
        .sort((a, b) => Math.abs(b.c.score - b.o.score) - Math.abs(a.c.score - a.o.score))
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
            {p.server} 상위 1,000명이 참가한 경기, {view.season && `${view.season}, `}
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
          <div className="tabs tier-role" role="group" aria-label="역할군">
            {[null, ...roles].map((r) => (
              <button key={r ?? "all"} type="button" aria-pressed={role === r} onClick={() => setRole(r)}>
                {r ?? "전체"}
              </button>
            ))}
          </div>
          <div className="tabs sort" role="group" aria-label="정렬">
            {(
              [
                ["score", "점수 순"],
                ["pick", "픽률 순"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)}>
                {label}
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
                RP 획득 {w.gain * 100}%, 평균 순위 {w.place * 100}%, TOP 3 비율 {w.top3 * 100}%를 합쳐 계산합니다.
                <br />
              </>
            )}
            RP 획득, 순위, TOP 3 비율에서는 참가자의 시작 RP 구간 평균을 빼고 계산합니다.
            <br />
            실험체는 무기마다 따로 점수를 매기고, 판 수가 적은 무기는 점수를 그 실험체의 전체 점수에 가깝게 보정합니다.
            <br />
            {p.few ? `${p.thin}판 미만이거나 유효 플레이어가 ${p.few}명 미만인 실험체는 흐리게 표시합니다.` : `${p.thin}판 미만인 실험체는 흐리게 표시합니다.`}
            {p.few && (
              <>
                <br />
                유효 플레이어는 플레이어마다 자기가 한 판 수를 전체 판 수로 나눈 비율을 제곱해 모두 더한 값의 역수입니다.
                <br />
                판이 적은 수의 플레이어에게 몰릴수록 값이 작아집니다.
              </>
            )}
            {prev && (
              <>
                <br />
                패치 비교에는 점수 차이의 90% 범위에 0이 포함되지 않는 실험체만 표시합니다.
              </>
            )}
          </p>
        </details>
        {prev && moved.length > 0 && (
          <details className="tier-how tier-moved">
            <summary>
              {prev.patch} 패치보다 점수가 크게 바뀐 실험체 {moved.length}개
            </summary>
            <MovedList title="강해진 실험체" list={moved.filter((m) => m.c.score > m.o.score)} />
            <MovedList title="약해진 실험체" list={moved.filter((m) => m.c.score < m.o.score)} />
          </details>
        )}
      </div>

      {!shown.length && (
        <p className="panel px-5 py-4" role="status">
          조건에 맞는 실험체가 없습니다.
          <br />
          역할군이나 검색어를 바꿔 주세요.
        </p>
      )}
      {groups.map(([g, list]) => {
        if (!list.length) return null;
        const flat = g === "pick";
        return (
          <section key={g} className={flat ? "tier-board flat" : "tier-board"} aria-label={flat ? "픽률 순" : `${g} 등급`}>
            {!flat && (
              <div className="tier-gl">
                <span className="tier-grade" data-grade={g}>
                  {g}
                </span>
              </div>
            )}
            <div className="tier-cards">
              {list.map((c) => {
                const key = `${c.char}:${c.weapon}`;
                const on = key === open;
                return (
                  <button
                    key={key}
                    type="button"
                    className="tier-card"
                    data-thin={c.n < p.thin || (p.few != null && c.ep != null && c.ep < p.few) || undefined}
                    aria-expanded={on}
                    aria-controls={on ? "tier-dx" : undefined}
                    onClick={(e) => {
                      trigger.current = e.currentTarget;
                      setOpen(on ? null : key);
                      // 넓은 화면은 패널이 열리며 보드 폭이 줄어 고른 카드가 화면 밖으로 밀릴 수 있음
                      const card = e.currentTarget;
                      if (!on) requestAnimationFrame(() => card.scrollIntoView({ block: "nearest" }));
                    }}
                  >
                    <span className="tier-pw">
                      {/* 새 실험체는 초상 파일을 더하기 전까지 칸만 남김 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={122} height={122} loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                      <span className="tier-wb">
                        <Weapon code={c.weapon} />
                      </span>
                      {flat && (
                        <span className="tier-grade sm tier-cg" data-grade={c.grade}>
                          {c.grade}
                        </span>
                      )}
                    </span>
                    <b>{c.name}</b>
                    <small>{c.weaponName}</small>
                    <span className="tier-sc">{signed(c.score)}</span>
                    <small>{int(c.n)}판</small>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {sel && <Drawer key={open} c={sel} onClose={close} />}
    </>
  );
}
