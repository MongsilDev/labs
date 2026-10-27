"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/er/lib/client";
import Lines from "@/components/Lines";

export default function InviteAccept({ token, loggedIn }: { token: string; loggedIn: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!loggedIn) {
    return (
      <a className="btn discord lg w-full" href={`/auth/login?next=${encodeURIComponent(`/er/i/${token}`)}`}>
        디스코드로 로그인하고 수락
      </a>
    );
  }
  return (
    <>
      {error && (
        <p className="text-[13px] text-minus" role="alert">
          <Lines text={error} />
        </p>
      )}
      <button
        type="button"
        className="btn primary lg w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await api.accept(token);
            router.push(`/er/t/${r.code}/a`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "수락하지 못했습니다.\n잠시 후 다시 시도해주세요.");
            setBusy(false);
          }
        }}
      >
        운영자로 참여
      </button>
    </>
  );
}
