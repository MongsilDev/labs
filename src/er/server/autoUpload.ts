import "server-only";

// 사용자 결정(ops 352)에 따라 갈아 끼우는 값. 기본값은 계획의 추천안이고, 환경 변수로 덮어씀
export type AutoConfig = {
  // 352-2 토큰을 채운 감시 파일을 내려줌(file) 또는 창을 열 때 붙여 넣음(paste)
  ship: "file" | "paste";
  // 352-3 명단이 맞는 조가 여럿이면 거절(roster) 또는 가장 최근에 바뀐 대회의 조(latest)
  many: "roster" | "latest";
  // 352-4 아무 조와도 맞지 않을 때 이름을 모르는 조가 하나뿐이면 반영(single) 또는 거절(reject)
  first: "single" | "reject";
  // 352-5 새 대회의 처음 상태 꺼짐(off), 켜짐(on), 설정 없이 모든 대회(none). 스크림봇 대회는 off와 on에서 켜짐
  optin: "off" | "on" | "none";
};

const pick = <T extends string>(v: string | undefined, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);

export function autoConfig(): AutoConfig {
  const e = process.env;
  return {
    ship: pick(e.AUTO_UPLOAD_SHIP, ["file", "paste"], "file"),
    many: pick(e.AUTO_UPLOAD_MANY, ["roster", "latest"], "roster"),
    first: pick(e.AUTO_UPLOAD_FIRST, ["single", "reject"], "single"),
    optin: pick(e.AUTO_UPLOAD_OPTIN, ["off", "on", "none"], "off"),
  };
}

// 결과 CSV 닉네임과 명단을 비교할 때 씀. 대소문자만 다른 계정은 드물어 조를 고르는 데에는 같게 봄
export const nick = (s: string) => s.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

export type GroupNames = { t: { id: number; updated_at: number }; g: number; names: Set<string> };

export type GroupPick<C extends GroupNames> = { ok: true; c: C } | { ok: false; reason: "empty" | "many" | "none"; message: string };

// 결과에 나온 닉네임의 절반 이상이 아는 이름인 조를 맞는 조로 봄. 대타와 닉네임 변경이 있어 전원 일치는 요구하지 않음
export function pickGroup<C extends GroupNames>(groups: C[], players: string[], cfg: AutoConfig): GroupPick<C> {
  const seen = [...new Set(players.map(nick))];
  if (!groups.length) return { ok: false, reason: "empty", message: "자동 업로드를 받는 대회가 없습니다." };
  const scored = groups.map((c) => ({ c, hit: seen.filter((n) => c.names.has(n)).length }));
  const matched = scored.filter((s) => s.c.names.size > 0 && s.hit * 2 >= seen.length && s.hit > 0);
  if (matched.length === 1) return { ok: true, c: matched[0].c };
  if (matched.length > 1) {
    if (cfg.many === "roster") return { ok: false, reason: "many", message: "명단이 맞는 조가 여럿이라 반영하지 않았습니다. 디스코드나 Labs에서 직접 올려주세요." };
    matched.sort((a, b) => b.c.t.updated_at - a.c.t.updated_at || b.hit - a.hit);
    return { ok: true, c: matched[0].c };
  }
  const unknown = scored.filter((s) => s.c.names.size === 0);
  // 명단과 조금이라도 겹친 경기는 대타가 많은 그 조의 경기일 수 있어 이름 모르는 조로 보내지 않음
  if (cfg.first === "single" && unknown.length === 1 && scored.every((s) => s.hit === 0)) return { ok: true, c: unknown[0].c };
  return { ok: false, reason: "none", message: "명단이 맞는 조가 없어 반영하지 않았습니다." };
}
