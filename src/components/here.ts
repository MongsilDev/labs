// login=failed는 다시 돌아와도 경고가 남지 않도록 뺌. 쿼리는 safeNext가 받는 문자로 다시 인코딩
export function here(path: string, search = "") {
  const q = new URLSearchParams(search);
  q.delete("login");
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
