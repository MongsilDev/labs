"use client";

import { Fragment, useEffect, useState } from "react";
import { int } from "@/er/lib/cut";
import { BADGE, hiddenRoute, itemIcon, signed, tacIcon, traitIcon, type TierItem, type TierRoute, type TierRouteInfo } from "@/er/lib/tier";

const SHOW = 5;
// dak.gg 루트 페이지의 작성자 링크와 같은 형식. 닉네임은 encodeURIComponent
const DAK = "https://dak.gg/er";

const older = (ver: string, patch: string) => {
  const [a, b] = ver.split(".").map(Number);
  const [c, d] = patch.split(".").map(Number);
  return a < c || (a === c && b < d);
};

function Icon({ src, alt }: { src: string | null; alt?: string | null }) {
  // 팬키트에 없는 아이콘은 자리만 남겨 이름 시작 위치를 맞춤
  if (!src) return <span className="tdx-ic" title={alt ?? undefined} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="tdx-ic" src={src} alt={alt ?? ""} title={alt || undefined} width={32} height={32} loading="lazy" />;
}

export function Rp({ g }: { g: number | null }) {
  if (g == null) return <td className="g">-</td>;
  return <td className={g > 0 ? "g up" : g < 0 ? "g down" : "g"}>{signed(g)}</td>;
}

export default function RouteTable({ list, info, items, dn, patch }: { list: TierRoute[]; info?: Record<string, TierRouteInfo>; items?: Record<string, TierItem>; dn: number; patch: string | null }) {
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

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

  const shown = all ? list : list.slice(0, SHOW);
  return (
    <>
      <table className="tdx-tb tdx-rt">
        <thead>
          <tr>
            <th scope="col" className="l">
              <span className="sr-only">루트</span>
            </th>
            <th scope="col" className="p">
              플레이어
            </th>
            <th scope="col" className="n">
              판 수
            </th>
            <th scope="col" className="r">
              비율
            </th>
            <th scope="col" className="g">
              RP 획득
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map(([id, players, n, g, b], i) => {
            const x = info?.[id];
            const [rawTitle, nick, trait, traitName, tac, tacName, codes, paths, ver] = x ?? [];
            const title = rawTitle?.trim();
            const hidden = hiddenRoute(x);
            return (
              <tr key={id}>
                <td className="l">
                  <div className="tdx-r">
                    <span className="tdx-no">{i + 1}</span>
                    <span className="tdx-build">
                      <Icon src={traitIcon(trait)} alt={traitName} />
                      <Icon src={tacIcon(tac)} alt={tacName} />
                    </span>
                    <div className="tdx-rm">
                      <div className="tdx-l1">
                        {title ? (
                          <a className="tdx-title" href={`${DAK}/routes/${id}`} target="_blank" rel="noopener noreferrer" title={title}>
                            {title}
                          </a>
                        ) : (
                          <span className={hidden ? "tdx-title tdx-hid" : "tdx-title"}>{hidden ? "공개되지 않은 루트" : `루트 ${id}`}</span>
                        )}
                        {/* 게임이 본문을 주지 않는 루트는 번호로 불러올 수 없어 복사 버튼을 두지 않음 */}
                        {!hidden && (
                          <button type="button" className="tdx-copy" aria-label={`루트 번호 ${id} 복사`} onClick={() => copy(id)}>
                            {id}
                            {copied === id ? <CheckIcon /> : <CopyIcon />}
                          </button>
                        )}
                        {(b || nick) && (
                          <span className="tdx-by">
                            {b && (
                              <span className="tdx-b" data-b={b}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={BADGE[b].img} alt="" width={14} height={16} />
                                {BADGE[b].label}
                              </span>
                            )}
                            {nick && (
                              <a href={`${DAK}/players/${encodeURIComponent(nick)}`} target="_blank" rel="noopener noreferrer">
                                {nick}
                              </a>
                            )}
                          </span>
                        )}
                      </div>
                      {(!!codes?.length || !!paths?.length) && (
                        <div className="tdx-l2">
                          {!!codes?.length && (
                            <span className="tdx-items">
                              {codes.map((c, k) => {
                                const [name, grade] = items?.[c] ?? [];
                                const src = itemIcon(c);
                                return (
                                  <span key={`${c}:${k}`} className={src ? "tdx-it" : "tdx-it tdx-itn"} data-g={grade ?? undefined} title={src ? name : undefined}>
                                    {/* 팬키트에 그림이 없는 아이템은 이름을 칸에 적음 */}
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {src ? <img src={src} alt={name ?? ""} width={50} height={28} loading="lazy" /> : name}
                                  </span>
                                );
                              })}
                            </span>
                          )}
                          {!!paths?.length && (
                            <span className="tdx-path">
                              {paths.map((a, k) => (
                                <Fragment key={`${a}:${k}`}>
                                  {k > 0 && (
                                    <svg viewBox="0 0 6 10" width="6" height="10" aria-label="다음">
                                      <path d="M1 1l4 4-4 4" />
                                    </svg>
                                  )}
                                  <span>{a}</span>
                                </Fragment>
                              ))}
                            </span>
                          )}
                          {ver && patch && older(ver, patch) && <span className="tdx-old">{ver} 패치</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p">{int(players)}명</td>
                <td className="n">{int(n)}</td>
                <td className="r">{((n / dn) * 100).toFixed(1)}%</td>
                <Rp g={g} />
              </tr>
            );
          })}
        </tbody>
      </table>
      {list.length > SHOW && (
        <button type="button" className="tdx-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "접기" : `${list.length - SHOW}개 더 보기`}
        </button>
      )}
      <p className="sr-only" aria-live="polite">
        {copied != null ? "루트 번호를 복사했습니다." : ""}
      </p>
    </>
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
