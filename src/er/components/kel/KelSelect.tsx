"use client";

import { useRouter } from "next/navigation";

// 좁은 화면에서 탭 대신 쓰는 드롭다운. 값은 서버가 만든 탭 주소
export default function KelSelect({ label, items, current, className = "" }: { label: string; items: readonly (readonly [string, string])[]; current: string; className?: string }) {
  const router = useRouter();
  return (
    // 서버 응답 전에도 고른 값을 보여 주려고 비제어로 두고, 주소가 바뀌면 key로 새로 그림
    <select key={current} className={`field ${className}`} aria-label={label} defaultValue={current} onChange={(e) => router.push(e.target.value)}>
      {items.map(([href, name]) => (
        <option key={href} value={href}>
          {name}
        </option>
      ))}
    </select>
  );
}
