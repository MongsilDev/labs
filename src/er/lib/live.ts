// 읽기 탭이 보내고 경기 중 순위 상자가 받는 이번 라운드 값
export type LiveTeam = {
  slot: number;
  teamId: string | null;
  name: string | null;
  ts: number | null;
  ks: number | null;
  out: boolean;
  place: number | null;
  fixed: boolean;
  color: string | null;
};

export type LiveFrame = { roundNo: number; at: number; teams: LiveTeam[] };

export type LiveRow = { key: string; name: string; rank: number; total: number; ts: number | null; out: boolean; place: number | null; color: string | null };

export const SLOTS = 8;
const MAX_NAME = 24;

const score = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 99 ? Math.round(v * 10) / 10 : null);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) || null : null);

/** 받은 본문을 LiveFrame으로. 모양이 다르면 null */
export function parseFrame(raw: unknown): LiveFrame | null {
  const d = raw as { roundNo?: unknown; teams?: unknown } | null;
  if (!d || typeof d !== "object" || !Array.isArray(d.teams) || d.teams.length > SLOTS) return null;
  const roundNo = d.roundNo;
  if (typeof roundNo !== "number" || !Number.isInteger(roundNo) || roundNo < 1 || roundNo > 99) return null;
  const seen = new Set<number>();
  const teams: LiveTeam[] = [];
  for (const t of d.teams as Record<string, unknown>[]) {
    if (!t || typeof t !== "object") return null;
    const slot = t.slot;
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 1 || slot > SLOTS || seen.has(slot)) return null;
    seen.add(slot);
    const place = t.place;
    teams.push({
      slot,
      teamId: text(t.teamId, 200),
      name: text(t.name, MAX_NAME),
      ts: score(t.ts),
      ks: score(t.ks),
      out: t.out === true,
      place: typeof place === "number" && Number.isInteger(place) && place >= 1 && place <= SLOTS ? place : null,
      fixed: t.fixed === true,
      color: typeof t.color === "string" && /^#[0-9a-f]{6}$/.test(t.color) ? t.color : null,
    });
  }
  return { roundNo, at: Date.now(), teams: teams.sort((a, b) => a.slot - b.slot) };
}

// 게임 안 TS에 들어가는 순위 점수. 1위 10점부터 8위 0점
const PLACE_BY_POINTS = new Map([
  [10, 1],
  [7, 2],
  [5, 3],
  [4, 4],
  [3, 5],
  [2, 6],
  [1, 7],
  [0, 8],
]);

/** 탈락한 팀의 순위. TS에서 KS를 뺀 순위 점수로 정하고, 값이 없으면 탈락한 그때 남아 있던 팀 수로 정함 */
export function outPlace(ts: number | null, ks: number | null, left: number): number {
  if (ts !== null && ks !== null) {
    const p = PLACE_BY_POINTS.get(Math.round((ts - ks) * 10) / 10);
    if (p) return p;
  }
  return Math.max(1, Math.min(SLOTS, left));
}

/**
 * 지난 라운드까지의 누적에 이번 라운드 TS를 더한 순위. 확정 기록이 이미 그 라운드를 담고 있으면 누적만 보여 줌.
 * 연결하지 않은 카드는 운영자가 적은 이름이나 카드 번호로 따로 줄을 만듦
 */
export function liveRows(standings: { key: string; name: string; total: number }[], frame: LiveFrame | null, played: number): { rows: LiveRow[]; live: boolean } {
  const live = !!frame && frame.roundNo > played;
  const byId = new Map<string, LiveTeam>();
  const loose: LiveTeam[] = [];
  // 라운드 사이에도 마지막 장면의 카드 색은 남김
  if (frame)
    for (const t of frame.teams) {
      if (t.teamId && standings.some((s) => s.key === t.teamId)) byId.set(t.teamId, t);
      else if (live && (t.ts !== null || t.name)) loose.push(t);
    }
  const rows: Omit<LiveRow, "rank">[] = [
    ...standings.map((s) => {
      const t = byId.get(s.key);
      const now = live ? t : undefined;
      return { key: s.key, name: s.name, total: s.total + (now?.ts ?? 0), ts: live ? (now?.ts ?? null) : null, out: !!now?.out, place: now?.out ? now.place : null, color: t?.color ?? null };
    }),
    ...loose.map((t) => ({ key: `slot:${t.slot}`, name: t.name ?? `${t.slot}번 팀`, total: t.ts ?? 0, ts: t.ts, out: t.out, place: t.out ? t.place : null, color: t.color })),
  ];
  // 누적이 같으면 기존 순위표 순서를 그대로 둠
  const order = rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.total - a.r.total || a.i - b.i);
  let rank = 0;
  let prev = NaN;
  const ranked = order.map(({ r }, i) => {
    if (Math.round(r.total * 10) !== Math.round(prev * 10)) rank = i + 1;
    prev = r.total;
    return { ...r, rank };
  });
  return { rows: ranked, live };
}

/** 카드 번호에 맞는 labs 팀. 기본 팀 이름(Team N)은 로비 자리 번호라 같은 번호의 카드와 같은 팀일 가능성이 큼 */
export function suggestTeams(standings: { key: string; bases: { round: number; base: string }[] }[]): Record<number, string> {
  const out: Record<number, string> = {};
  const latest = Math.max(0, ...standings.flatMap((s) => s.bases.map((b) => b.round)));
  for (const s of standings) {
    const b = s.bases.find((x) => x.round === latest);
    const m = b && /^\d+R team\s*(\d+)$/i.exec(b.base);
    const slot = m ? Number(m[1]) : 0;
    if (slot >= 1 && slot <= SLOTS && !out[slot]) out[slot] = s.key;
  }
  return out;
}
