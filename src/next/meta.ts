import type { TierCombo, TierView } from "@/er/lib/tier";

export type Spot = TierCombo & { sure: boolean; weak: boolean; popular: boolean };

export function spots(view: TierView): { list: Spot[]; median: number } {
  const picks = view.combos.map((c) => c.pick).sort((a, b) => a - b);
  const median = picks[Math.floor(picks.length / 2)];
  const list = view.combos.map((c) => {
    const half = c.half ?? Infinity;
    return { ...c, sure: c.score - half > 0, weak: c.score + half < 0, popular: c.pick >= median };
  });
  return { list, median };
}
