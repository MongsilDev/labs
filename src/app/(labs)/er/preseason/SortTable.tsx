"use client";

import { useState, type ReactNode } from "react";

export type Col = { label: string; cls?: string; tip?: string; first?: "asc" | "desc" };
export type Row = { id: string; vals: (number | null)[]; cells: ReactNode; dim?: boolean; no?: number };
export type Group = { label: string; span: number };

/**
 * 숫자 열 헤더를 누르면 그 열로 정렬하고, 다시 누르면 방향을 바꾸는 표. first가 없는 열은 정렬하지 않음.
 * 처음에는 넘겨받은 순서 그대로 보여 주고, show줄이 넘으면 나머지는 버튼으로 펼침. groups는 열 묶음 이름을 적는 윗줄
 */
export default function SortTable({ cols, rows, show = 20, numbered, groups }: { cols: Col[]; rows: Row[]; show?: number; numbered?: boolean; groups?: Group[] }) {
  const [order, setOrder] = useState<[number, "asc" | "desc"] | null>(null);
  const [all, setAll] = useState(false);
  let list = rows;
  if (order) {
    const [k, dir] = order;
    // 값이 없는 줄은 방향과 관계없이 맨 아래
    list = [...list].sort((a, b) => {
      const x = a.vals[k], y = b.vals[k];
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return dir === "asc" ? x - y : y - x;
    });
  }
  const shown = all ? list : list.slice(0, show);
  return (
    <>
      <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
        <table className="tbl">
          <thead>
            {groups && (
              <tr>
                {numbered && <th className="pin-n" />}
                {groups.map((g, i) => (
                  <th key={i} colSpan={g.span} scope="colgroup" className={g.label ? "grp" : i === 0 ? "pin-l" : undefined}>
                    {g.label}
                  </th>
                ))}
              </tr>
            )}
            <tr>
              {numbered && <th className="pin-n">#</th>}
              {cols.map((c, i) => (
                <th key={i} className={c.cls} data-tip={c.tip} aria-sort={order?.[0] === i ? (order[1] === "asc" ? "ascending" : "descending") : undefined}>
                  {c.first ? (
                    <button type="button" className="sort-h" onClick={() => setOrder(order?.[0] === i ? [i, order[1] === "asc" ? "desc" : "asc"] : [i, c.first!])}>
                      {c.label}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} className={r.dim ? "opacity-50" : undefined}>
                {numbered && <td className="pin-n text-ink-3">{r.no ?? i + 1}</td>}
                {r.cells}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > show && (
        <button type="button" className="btn mt-2 w-full justify-center" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "접기" : `${list.length - show}개 더 보기`}
        </button>
      )}
    </>
  );
}
