"use client";

import { useId, useState } from "react";
import { EMPTY_QUERY } from "./SearchBox";

// 빈 칸 제출만 막고 검색은 계정 조회 화면이 맡음
export default function HubSearch() {
  const [empty, setEmpty] = useState(false);
  const errId = useId();
  return (
    <>
      <form
        className="flex gap-2"
        action="/tarkov/players"
        method="get"
        role="search"
        onSubmit={(e) => {
          if (String(new FormData(e.currentTarget).get("q") ?? "").trim()) return;
          e.preventDefault();
          setEmpty(true);
        }}
      >
        <input
          className="field min-w-0 flex-1"
          type="search"
          name="q"
          placeholder="닉네임 또는 계정 번호"
          aria-label="닉네임 또는 계정 번호"
          aria-invalid={empty || undefined}
          aria-describedby={empty ? errId : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={32}
          onInput={() => setEmpty(false)}
        />
        <button className="btn primary" type="submit">
          조회
        </button>
      </form>
      {empty && (
        <p id={errId} className="mt-2 text-[13px] text-minus" role="alert">
          {EMPTY_QUERY}
        </p>
      )}
    </>
  );
}
