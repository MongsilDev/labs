/**
 * dak-stopped 파일 내용으로 dak.gg 조회를 멈출지 판정함. 파일이 없으면 null.
 * 적힌 시각 전까지 멈추고, 시각을 읽을 수 없으면 파일을 지울 때까지 멈춤
 */
export function dakStopped(text, now) {
  if (text == null) return false;
  const until = Date.parse(text.trim());
  return Number.isNaN(until) || now < until;
}
