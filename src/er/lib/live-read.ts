import type { CardRead } from "./hud";
import { outPlace, SLOTS } from "./live";

// 읽기 탭의 카드 하나. 한 장면의 오독을 버리려고 같은 값을 두 번 연속 읽어야 바꿈
export type Slot = {
  slot: number;
  ts: number | null;
  ks: number | null;
  out: boolean;
  place: number | null;
  fixed: boolean;
  pend: string | null;
  outRun: number;
  warn: boolean;
};

export const emptySlots = (): Slot[] =>
  Array.from({ length: SLOTS }, (_, i) => ({ slot: i + 1, ts: null, ks: null, out: false, place: null, fixed: false, pend: null, outRun: 0, warn: false }));

const keyOf = (ts: number | null, ks: number | null) => `${ts}/${ks}`;

/** 한 번 읽은 결과를 반영. 운영자가 고친 카드는 그대로 두고, 탈락은 두 번 연속 보일 때만 표시하며 한 번 표시하면 되돌리지 않음 */
export function applyRead(slots: Slot[], cards: CardRead[]): Slot[] {
  const alive = slots.filter((s) => !s.out).length;
  const next = slots.map((s) => {
    const c = cards[s.slot - 1];
    if (!c || s.fixed) return s;
    let { ts, ks, pend, warn, outRun, out, place } = s;
    if (c.ts !== null && c.ks !== null) {
      const k = keyOf(c.ts, c.ks);
      if (k === keyOf(ts, ks)) {
        pend = null;
        warn = false;
      } else if (k === pend) {
        ts = c.ts;
        ks = c.ks;
        pend = null;
        warn = false;
      } else {
        // 확인을 기다리던 값과 또 다르게 읽히면 운영자에게 알림
        warn = pend !== null;
        pend = k;
      }
    }
    outRun = c.out ? outRun + 1 : 0;
    if (!out && outRun >= 2) {
      out = true;
      place = outPlace(ts, ks, alive);
    }
    return { ...s, ts, ks, pend, warn, outRun, out, place };
  });
  return next;
}

/** 운영자가 고친 값. 이 카드는 다시 풀 때까지 읽은 값으로 바뀌지 않음 */
export function fixSlot(slots: Slot[], slot: number, patch: Partial<Pick<Slot, "ts" | "ks" | "out" | "place">>): Slot[] {
  return slots.map((s) => (s.slot === slot ? { ...s, ...patch, fixed: true, pend: null, warn: false } : s));
}

export const unfixAll = (slots: Slot[]): Slot[] => slots.map((s) => ({ ...s, fixed: false }));
