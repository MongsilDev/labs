"use client";

import { useState, type ReactNode } from "react";

export type Col = { label: string; cls?: string; tip?: string; first?: "asc" | "desc" };
export type Row = { id: string; vals: (number | null)[]; cells: ReactNode; find?: string; dim?: boolean };

/**
 * 숫자 열 헤더를 누르면 그 열로 정렬하고, 다시 누르면 방향을 바꾸는 표. first가 없는 열은 정렬하지 않음.
 * 처음에는 넘겨받은 순서 그대로 보여 주고, show줄이 넘으면 나머지는 버튼으로 펼침
 */
export default function SortTable({ cols, rows, show = 20, numbered, search }: { cols: Col[]; rows: Row[]; show?: number; numbered?: boolean; search?: boolean }) {
  const [order, setOrder] = useState<[number, "asc" | "desc"] | null>(null);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const query = q.replace(/\s+/g, "");
  let list = query ? rows.filter((r) => r.find?.replace(/\s+/g, "").includes(query)) : rows;
  if (order) {
    const [k, dir] = order;
    // 값이 없는 줄은 방향과 관계없이 맨 아래
    list = [...list].sort((a, b) => {
      const x = a.vals[k], y = b.vals[k];
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
      return dir === "asc" ? x - y : y - x;
    });
  }
  const shown = all || query ? list : list.slice(0, show);
  return (
    <>
      {search && <input className="field mb-3 h-9 max-w-[240px] text-[14px]" type="search" placeholder="실험체 검색" aria-label="실험체 검색" value={q} onChange={(e) => setQ(e.target.value)} />}
      <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
        <table className="tbl">
          <thead>
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
                {numbered && <td className="pin-n text-ink-3">{i + 1}</td>}
                {r.cells}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!query && list.length > show && (
        <button type="button" className="btn mt-2 w-full justify-center" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "접기" : `${list.length - show}개 더 보기`}
        </button>
      )}
    </>
  );
}
