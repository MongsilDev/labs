"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useState } from "react";
import { int } from "@/er/lib/cut";
import { timeKo } from "@/er/lib/format";
import { comboPath, compareView, movedCombos, signed, type TierCombo, type TierMoved, type TierView } from "@/er/lib/tier";
import { Weapon } from "./parts";

const GRADES: TierCombo["grade"][] = ["S", "A", "B", "C", "D"];
// 상세로 떠날 때 목록 주소와 스크롤 위치를 남기는 탭 단위 저장소 키. 30분이 지나면 쓰지 않음
const BACK = "tier:back";
const BACK_MS = 30 * 60_000;

// 수정 키나 가운데 버튼으로 새 탭에 열면 이 탭은 떠나지 않으므로 남기지 않음
function saveBack(e?: MouseEvent<HTMLElement>) {
  if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)) return;
  try {
    sessionStorage.setItem(BACK, JSON.stringify({ url: window.location.pathname + window.location.search, y: window.scrollY, t: Date.now() }));
  } catch {}
}

function readBack(): { url: string; y: number } | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(BACK) ?? "null");
    sessionStorage.removeItem(BACK);
    return saved && Date.now() - saved.t < BACK_MS ? saved : null;
  } catch {
    return null;
  }
}
const ROLES = ["탱커", "전사", "암살자", "스킬 딜러", "원거리 딜러", "지원가"];

type Props = {
  views: TierView[];
  initial: string;
  initialRole: string | null;
  initialSort: "score" | "pick";
  initialQuery: string;
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

function MovedList({ title, list }: { title: string; list: TierMoved[] }) {
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

// 줄 어디를 눌러도 이름 링크를 누른 것과 같음. 키보드는 이름 링크로 엶
function PickTable({ list, thin, href, onOpen }: { list: TierCombo[]; thin: (c: TierCombo) => boolean; href: (c: TierCombo) => string; onOpen: (e?: MouseEvent<HTMLElement>) => void }) {
  const router = useRouter();
  return (
    <table className="kel-table tier-table">
      <thead>
        <tr>
          <th className="tier-no">#</th>
          <th className="l">실험체</th>
          <th className="tier-gc">등급</th>
          <th className="tier-pk" aria-sort="descending">
            픽률
            <svg viewBox="0 0 10 6" aria-hidden="true">
              <path d="M1 1l4 4 4-4" />
            </svg>
          </th>
          <th className="tier-s">점수</th>
          <th className="tier-x">승률</th>
          <th className="tier-x">TOP 3</th>
          <th className="tier-x">평균 순위</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c, i) => {
          const key = `${c.char}:${c.weapon}`;
          return (
            <tr
              key={key}
              data-thin={thin(c) || undefined}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest("a")) return;
                onOpen();
                router.push(href(c));
              }}
            >
              <td className="tier-no">{i + 1}</td>
              <td className="l">
                <span className="tier-who">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={36} height={36} loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                  <Link href={href(c)} prefetch={false} onClick={onOpen}>
                    <b className="tier-wi">
                      <Weapon code={c.weapon} label={c.weaponName} />
                      {c.name}
                    </b>
                  </Link>
                </span>
              </td>
              <td className="tier-gc">
                <span className="tier-grade sm" data-grade={c.grade}>
                  {c.grade}
                </span>
              </td>
              <td className="tier-pk">
                <b>{c.pick.toFixed(2)}%</b>
                <small>{int(c.n)}판</small>
              </td>
              <td className="tier-s">{signed(c.score)}</td>
              <td className="tier-x">{c.win.toFixed(1)}%</td>
              <td className="tier-x">{c.top3.toFixed(1)}%</td>
              <td className="tier-x">{c.place.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function TierBoard(p: Props) {
  const [id, setId] = useState(p.initial);
  const [role, setRole] = useState<string | null>(p.initialRole);
  const [sort, setSort] = useState<"score" | "pick">(p.initialSort);
  const [q, setQ] = useState(p.initialQuery);
  const view = p.views.find((v) => v.id === id) ?? p.views[0];
  const thin = (c: TierCombo) => c.n < p.thin || (p.few != null && c.ep != null && c.ep < p.few);
  const href = (c: TierCombo) => comboPath(c, view.id === p.fallback ? null : view.id);

  // 뒤로 가기는 처음 렌더한 목록을 다시 쓰므로 상태를 주소에 맞춤.
  // 위쪽 「실험체 티어」 링크로 돌아오면 주소에 역할군과 정렬이 없어 떠날 때 저장한 주소를 씀
  useEffect(() => {
    const saved = readBack();
    const now = new URL(window.location.href);
    const was = saved && new URL(saved.url, window.location.origin);
    const same = !!was && now.pathname === was.pathname && (now.searchParams.get("v") ?? "") === (was.searchParams.get("v") ?? "");
    const src = same && now.search !== was.search && !["r", "s", "q"].some((k) => now.searchParams.has(k)) ? was : now;
    const v = src.searchParams.get("v");
    /* eslint-disable react-hooks/set-state-in-effect -- 주소와 탭 저장소는 수화 뒤에만 읽을 수 있음 */
    setId(p.views.some((x) => x.id === v) ? v! : p.fallback);
    setRole(src.searchParams.get("r"));
    setSort(src.searchParams.get("s") === "pick" ? "pick" : "score");
    setQ(src.searchParams.get("q") ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
    if (src !== now) window.history.replaceState(null, "", src.pathname + src.search);
    if (same) requestAnimationFrame(() => window.scrollTo(0, saved.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번만 맞춤
  }, []);

  // 기간, 역할군, 정렬, 검색어를 주소에 남겨 뒤로 가기와 공유에서 같은 목록을 보여 줌
  const keep = (next: { v?: string; r?: string | null; s?: "score" | "pick"; q?: string }) => {
    const url = new URL(window.location.href);
    const put = (k: string, val: string | null | undefined, empty: string | null) => (val == null || val === empty ? url.searchParams.delete(k) : url.searchParams.set(k, val));
    if ("v" in next) put("v", next.v, p.fallback);
    if ("r" in next) put("r", next.r, null);
    if ("s" in next) put("s", next.s, "score");
    if ("q" in next) put("q", next.q, "");
    window.history.replaceState(null, "", url);
  };
  const pick = (next: string) => {
    setId(next);
    const lost = role != null && !p.views.find((v) => v.id === next)?.combos.some((c) => c.roles?.includes(role));
    if (lost) setRole(null);
    keep({ v: next, ...(lost && { r: null }) });
  };

  const roles = [...ROLES, ...new Set(view.combos.flatMap((c) => c.roles ?? []))].filter((r, i, a) => a.indexOf(r) === i && view.combos.some((c) => c.roles?.includes(r)));
  // 「석궁 나딘」과 「나딘 석궁」 모두 찾음
  const query = q.replace(/\s+/g, "");
  const shown = view.combos.filter(
    (c) => (role == null || c.roles?.includes(role)) && (!query || `${c.weaponName}${c.name}`.replace(/\s+/g, "").includes(query) || `${c.name}${c.weaponName}`.replace(/\s+/g, "").includes(query)),
  );
  const groups: [string, TierCombo[]][] = sort === "pick" ? [["pick", [...shown].sort((a, b) => b.pick - a.pick || b.n - a.n)]] : GRADES.map((g) => [g, shown.filter((c) => c.grade === g)]);
  const w = p.weights;
  const prev = compareView(p.views, view, p.patch);
  const moved = prev ? movedCombos(shown, prev) : [];

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
              <button
                key={r ?? "all"}
                type="button"
                aria-pressed={role === r}
                onClick={() => {
                  setRole(r);
                  keep({ r });
                }}
              >
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
              <button
                key={k}
                type="button"
                aria-pressed={sort === k}
                onClick={() => {
                  setSort(k);
                  keep({ s: k });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <input className="field sm tier-search" type="search" placeholder="실험체 검색" aria-label="실험체 검색" value={q}
            onChange={(e) => {
              setQ(e.target.value);
              keep({ q: e.target.value });
            }}
          />
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
        if (g === "pick")
          return (
            <section key={g} className="tier-board flat" aria-label="픽률 순">
              <PickTable list={list} thin={thin} href={href} onOpen={saveBack} />
            </section>
          );
        return (
          <section key={g} className="tier-board" aria-label={`${g} 등급`}>
            <div className="tier-gl">
              <span className="tier-grade" data-grade={g}>
                {g}
              </span>
            </div>
            <div className="tier-cards">
              {list.map((c) => {
                const key = `${c.char}:${c.weapon}`;
                return (
                  <Link key={key} href={href(c)} prefetch={false} className="tier-card" data-thin={thin(c) || undefined} onClick={saveBack}>
                    <span className="tier-pw">
                      {/* 새 실험체는 초상 파일을 더하기 전까지 칸만 남김 */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/img/er/char/${c.key}.v1.webp`} alt="" width={122} height={122} loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                      <span className="tier-wb">
                        <Weapon code={c.weapon} label={c.weaponName} />
                      </span>
                    </span>
                    <b>{c.name}</b>
                    <span className="tier-sc">{signed(c.score)}</span>
                    <small>{int(c.n)}판</small>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
