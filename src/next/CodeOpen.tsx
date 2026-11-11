"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CodeOpen({ className = "max-w-[280px]" }: { className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const c = code.trim().toUpperCase();
        if (!/^[A-Z0-9]{6}$/.test(c)) return setError("받은 대회 코드를 다시 확인해주세요.");
        router.push(`/er/t/${c}/a`);
      }}
    >
      <label className="lbl" htmlFor="hub-code">대회 코드</label>
      <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 ${className}`}>
        <input
          id="hub-code"
          className="field font-bold tracking-[3px] uppercase"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          placeholder="ABC123"
          value={code}
          aria-describedby="hub-code-msg"
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError("");
          }}
        />
        <button className="btn">열기</button>
      </div>
      <p id="hub-code-msg" className="mt-1 h-4 text-[13px] leading-4 text-minus" role="alert">
        {error}
      </p>
    </form>
  );
}
