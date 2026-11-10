"use client";

import { useRouter } from "next/navigation";

// 보이는 글자는 지금 값이고, 투명한 select가 전체를 덮어 기기의 선택 화면을 엶
export default function Pick({ name, items }: { name: string; items: { href: string; label: string; on: boolean }[] }) {
  const router = useRouter();
  const now = items.find((i) => i.on) ?? items[0];
  return (
    <label className="pick">
      <span className="font-normal text-ink-3">{name}</span>
      <span className="min-w-0 truncate">{now.label}</span>
      <svg className="ml-auto flex-none text-ink-2" width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="m1 1 4 4 4-4" />
      </svg>
      <select aria-label={name} value={now.href} onChange={(e) => router.push(e.target.value)}>
        {items.map((i) => (
          <option key={i.href} value={i.href}>
            {i.label}
          </option>
        ))}
      </select>
    </label>
  );
}
