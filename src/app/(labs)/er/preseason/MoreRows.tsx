"use client";

import { Children, useState, type ReactNode } from "react";

const SHOW = 20;

/** 표 본문 행을 SHOW줄까지만 보여 주고 나머지는 버튼으로 펼침 */
export default function MoreRows({ head, children }: { head: ReactNode; children: ReactNode }) {
  const [all, setAll] = useState(false);
  const rows = Children.toArray(children);
  return (
    <>
      <table className="tbl">
        {head}
        <tbody>{all ? rows : rows.slice(0, SHOW)}</tbody>
      </table>
      {rows.length > SHOW && (
        <button type="button" className="btn mt-2 w-full justify-center" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "접기" : `${rows.length - SHOW}개 더 보기`}
        </button>
      )}
    </>
  );
}
