export const MODES = [
  { key: "season", folder: "pvp-season", label: "시즌", web: "pvp-season" },
  { key: "pvp", folder: "profile", label: "PvP", web: "regular" },
  { key: "pve", folder: "pve", label: "PvE", web: "pve" },
  { key: "arena", folder: "arena", label: "아레나", web: "arena" },
] as const;

export type Mode = (typeof MODES)[number];
export type ModeKey = Mode["key"];

export const modeOf = (key: string | null | undefined): Mode | undefined => MODES.find((m) => m.key === key);

export const tarkovDevUrl = (mode: Mode, aid: number) => `https://tarkov.dev/players/${mode.web}/${aid}`;

// tarkov.dev 플레이어 검색은 주소로 모드만 받고 닉네임은 받지 않음
export const tarkovDevSearchUrl = (mode?: Mode) => `https://tarkov.dev/players${mode ? `?gameMode=${mode.web}` : ""}`;

// 요청한 모드가 없으면 가장 최근에 갱신된 모드
export function pickMode(updated: Record<ModeKey, number | null> | null, asked?: string | null): Mode {
  const m = modeOf(asked);
  if (m) return m;
  let best: Mode = MODES[0];
  let at = -1;
  for (const x of MODES) {
    const u = updated?.[x.key] ?? -1;
    if (u > at) {
      at = u;
      best = x;
    }
  }
  return best;
}
