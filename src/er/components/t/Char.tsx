"use client";

import { characterName } from "@/er/lib/format";

// 얼굴 이미지는 scripts/er/portraits.mjs로 cdn.mongsil.dev에 올림
const CDN = "https://cdn.mongsil.dev/er-labs/characters";

// label을 주면 실험체 이름 대신 그 글자를 쓰고, 실험체 이름은 그림 설명으로 남김. 빈 label이면 설명 없는 얼굴만 나옴
export default function Char({ name, label, size = 22 }: { name: string; label?: string; size?: number }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="max-w-none flex-none rounded-full bg-field"
        style={{ width: size, height: size }}
        src={`${CDN}/${name}.png`}
        alt={label ? characterName(name) : ""}
        width={size}
        height={size}
        loading="lazy"
        ref={(img) => {
          // hydration 전에 실패한 그림은 onError가 오지 않음
          if (img?.complete && img.naturalWidth === 0 && img.currentSrc) img.hidden = true;
        }}
        onError={(e) => (e.currentTarget.hidden = true)}
      />
      {label ?? characterName(name)}
    </span>
  );
}
