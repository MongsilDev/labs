// 오버레이 설정 화면이 닉네임 없이 보여 주는 아시아1 1위. 수집기가 이미 받은 랭킹과 저장한 경기만 씀
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** first는 랭킹 1위 항목, games는 그 계정의 경기를 최근 순으로 { t, rank, gain }. gate는 이터니티 기준 RP. 못 미치면 null */
export function topView(first, games, gate, now) {
  if (!first?.nickname || !(first.mmr >= gate)) return null;
  const last = games[0];
  return {
    nickname: first.nickname,
    tier: "이터니티",
    mmr: first.mmr,
    place: "아시아1 1위",
    serverRank: 1,
    serverCode: 10,
    last: typeof last?.gain === "number" ? { gain: last.gain, at: Math.floor(last.t / 1000) } : null,
    recent: games.slice(0, 10).map((g) => g.rank),
    updatedAt: Math.floor(now / 1000),
  };
}

/** view가 null이어도 써서, 시즌 초처럼 1위가 기준에 못 미칠 때 앞선 시즌의 1위가 남지 않게 함 */
export function writeTop(root, view) {
  mkdirSync(join(root, "er-rank"), { recursive: true });
  const tmp = join(root, "er-rank", `.top.json.${process.pid}`);
  writeFileSync(tmp, JSON.stringify(view));
  renameSync(tmp, join(root, "er-rank", "top.json"));
}
