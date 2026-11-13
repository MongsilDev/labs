/**
 * 한 계정의 경기 목록(최신 판부터)에서 닉네임이 바뀐 지점을 찾음. last는 앞 쪽에서 마지막으로 본 판
 * 공식 문서는 닉네임을 바꾸기 전 판이 목록에 없다고 적지만, 11-13 실제 응답에는 예전 nickname 그대로 들어 있음
 */
export function renameSteps(games, last = null) {
  const steps = [];
  for (const g of games) {
    if (!g.nickname) continue;
    if (last && last.nickname !== g.nickname) steps.push({ old: g.nickname, new: last.nickname, oldLast: g.t, newFirst: last.t });
    last = g;
  }
  return { steps, last };
}
