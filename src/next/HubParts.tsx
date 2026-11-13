import Link from "next/link";
import { EVENT_NAME } from "@/er/lib/kel";
import type { TierCombo } from "@/er/lib/tier";
import type { Hub } from "./hub";

export const n = (v: number) => v.toLocaleString("ko-KR");
export const face = (c: TierCombo) => `/img/er/char/${c.key}.v1.webp`;

export function TierHead({ h, more = true }: { h: Hub; more?: boolean }) {
  return (
    <h2 className="sec-h">
      <Link href="/er/tier">실험체 티어</Link>
      {h.view && <small className="num">{h.view.label}, {n(h.view.games)}경기</small>}
      {more && <Link className="more" href="/er/tier">전체 {h.combos.length}개</Link>}
    </h2>
  );
}

export function TierMissing() {
  return <p className="py-3 text-ink-3">실험체 티어를 불러오지 못했습니다.</p>;
}

export function KelHead({ h }: { h: Hub }) {
  return (
    <h2 className="sec-h">
      <Link href="/er/kel">2026 KEL</Link>
      {h.final && <small>{EVENT_NAME[h.final.event]} {h.final.stage}</small>}
    </h2>
  );
}
