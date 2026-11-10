"use client";

import { useState } from "react";

export default function CopyField({ label, value }: { label: string; value: string }) {
  const [msg, setMsg] = useState("");
  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input className="field num" readOnly value={value} aria-label={label} onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="btn primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setMsg(`${label}를 복사했습니다.`);
            } catch {
              setMsg("복사하지 못했습니다. 주소를 직접 선택해 복사해주세요.");
            }
          }}
        >
          복사
        </button>
      </div>
      <p className="mt-1.5 min-h-[19px] text-[13px] text-ink-2" role="status">{msg}</p>
    </>
  );
}
