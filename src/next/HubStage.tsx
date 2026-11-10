"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { comboPath, signed, type TierCombo } from "@/er/lib/tier";

export type StageItem = { c: TierCombo; art: string | null };

const face = (c: TierCombo) => `/img/er/char/${c.key}.v1.webp`;

/** 시안 A 무대. 얼굴 줄에서 고른 실험체를 큰 이름과 반신 그림으로 보여 줌 */
export default function HubStage({ items }: { items: StageItem[] }) {
  const [at, setAt] = useState(0);
  const { c } = items[at];
  return (
    <div className="hub-stage">
      {/* 고를 때 그림이 늦게 뜨지 않게 다섯 장을 모두 받아 두고 하나만 보임 */}
      {items.map(({ c: x, art }, i) =>
        art ? (
          <Image key={x.key + x.weapon} className="hub-stage-art" src={art} alt="" width={390} height={576} unoptimized priority={i === 0} loading="eager" hidden={i !== at} />
        ) : (
          <Image key={x.key + x.weapon} className="hub-stage-face" src={face(x)} alt="" width={122} height={122} unoptimized hidden={i !== at} />
        ),
      )}
      <div className="hub-stage-id">
        <p className="hub-stage-wn">{c.weaponName}</p>
        <Link href={comboPath(c)} className="hub-stage-name" data-long={c.name.length > 4 || undefined}>
          {c.name}
        </Link>
        <dl className="hub-stage-stats num">
          <div className="hub-stage-score">
            <dt>점수</dt>
            <dd>{signed(c.score)}</dd>
          </div>
          <div>
            <dt>픽률</dt>
            <dd>{c.pick.toFixed(2)}%</dd>
          </div>
          <div>
            <dt>승률</dt>
            <dd>{c.win.toFixed(1)}%</dd>
          </div>
          <div>
            <dt>TOP 3</dt>
            <dd>{c.top3.toFixed(1)}%</dd>
          </div>
        </dl>
      </div>
      <div className="hub-stage-pick" role="group" aria-label="실험체 티어 상위 5개">
        {items.map(({ c: x }, i) => (
          <button key={x.key + x.weapon} type="button" aria-pressed={i === at} aria-label={`${i + 1}위 ${x.weaponName} ${x.name}`} onClick={() => setAt(i)}>
            <Image src={face(x)} alt="" width={56} height={56} unoptimized />
            <span className="num">{signed(x.score)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
