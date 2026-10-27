"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { readRecent, type Recent } from "@/er/lib/client";
import { remaining } from "@/er/lib/format";
import { MODE_LABEL } from "@/er/lib/rules";
import { useNow } from "@/er/lib/useNow";
import type { MyTournament } from "@/er/lib/view";
import Lines from "@/components/Lines";

const ITEM = "grid min-w-0 gap-1.5 rounded-lg border border-line px-4 py-3.5 no-underline hover:border-line-strong hover:bg-field";

export default function OpenCode({ mine }: { mine: MyTournament[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [recent, setRecent] = useState<Recent[]>([]);
  const [error, setError] = useState("");
  const now = useNow();
  useEffect(() => {
    const t = setTimeout(() => setRecent(readRecent()), 0);
    return () => clearTimeout(t);
  }, []);
  const mineCodes = new Set(mine.map((m) => m.code));
  const others = recent.filter((r) => !mineCodes.has(r.code));
  return (
    <>
      {mine.length > 0 && (
        <section className="panel px-5 py-[18px] max-[900px]:-order-1" aria-labelledby="mine-h">
          <h2 className="mb-3 text-[15px] font-bold" id="mine-h">
            내 대회
          </h2>
          <ul className="grid gap-2">
            {mine.map((m) => (
              <li key={m.code}>
                <Link className={ITEM} href={`/er/t/${m.code}/a`}>
                  <span className="flex min-w-0 items-center gap-2">
                    <b className="min-w-0 truncate text-[16px]">{m.name}</b>
                    <span className="chip ml-auto flex-none">{m.role === "owner" ? "개최자" : "운영자"}</span>
                  </span>
                  <span className="text-[13px] text-fg-2">
                    {MODE_LABEL[m.mode]}, {m.groupCount > 1 ? `${m.groupCount}개 조` : m.played ? `${m.played}라운드 진행` : "경기 전"}, {m.code}
                    {now !== null && `, ${remaining(m.expiresAt, now)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel px-5 py-[18px]" aria-labelledby="open-h">
        <h2 className="mb-3 text-[15px] font-bold" id="open-h">
          대회 열기
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const c = code.trim().toUpperCase();
            if (!/^[A-Z0-9]{6}$/.test(c)) return setError("대회 코드는 영문과 숫자 6자리입니다.\n받은 코드를 다시 확인해주세요.");
            router.push(`/er/t/${c}/a`);
          }}
        >
          <label className="lbl" htmlFor="code">
            대회 코드
          </label>
          <div className="grid max-w-[360px] grid-cols-[1fr_auto] gap-2">
            <input
              id="code"
              name="code"
              className="field font-bold tracking-[3px] uppercase"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={6}
              placeholder="ABC123"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
            />
            <button className="btn primary h-10">열기</button>
          </div>
          {error && (
            <p className="text-[13px] text-minus" role="alert">
              <Lines text={error} />
            </p>
          )}
        </form>
        {others.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-[13px] font-semibold text-fg-2">이 브라우저에서 연 대회</h3>
            <ul className="grid gap-2">
              {others.map((r) => (
                <li key={r.code}>
                  <Link className={ITEM} href={`/er/t/${r.code}/a`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <b className="min-w-0 truncate text-[16px]">{r.name}</b>
                    </span>
                    <span className="text-[13px] text-fg-2">{r.code}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
