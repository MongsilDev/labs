export type Part = { text: string; op: -1 | 0 | 1 };

// 숫자, 글자 묶음, 공백, 나머지 한 글자 단위. 「30초」는 30과 초로 나뉘어 숫자만 바뀐 경우가 숫자만 표시됨
const TOKEN = new RegExp(String.raw`\s+|\p{N}+(?:[.,]\p{N}+)*|[\p{L}\p{M}_]+|.`, "gsu");
// 두 토큰 수의 곱이 이보다 크면 LCS 표를 만들지 않고 통째로 바꾼 것으로 봄
const MAX_CELLS = 1_000_000;

function lcs(x: string[], y: string[]): Part[] {
  const n = x.length;
  const m = y.length;
  if (n * m > MAX_CELLS) return [{ text: x.join(""), op: -1 }, { text: y.join(""), op: 1 }];
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Part[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) out.push({ text: x[i++], op: (j++, 0) });
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ text: x[i++], op: -1 });
    else out.push({ text: y[j++], op: 1 });
  }
  while (i < n) out.push({ text: x[i++], op: -1 });
  while (j < m) out.push({ text: y[j++], op: 1 });
  return out;
}

// 바뀐 구간마다 지운 글을 앞에, 더한 글을 뒤에 모음. 바뀐 단어 사이의 공백 하나는 구간에 포함
function group(parts: Part[]): Part[] {
  const out: Part[] = [];
  let del = "";
  let ins = "";
  const flush = () => {
    if (del) out.push({ text: del, op: -1 });
    if (ins) out.push({ text: ins, op: 1 });
    del = ins = "";
  };
  parts.forEach((p, k) => {
    const inRun = (del || ins) && p.op === 0 && /^\s+$/.test(p.text) && parts[k + 1] && parts[k + 1].op !== 0;
    if (p.op === -1 || inRun) del += p.text;
    if (p.op === 1 || inRun) ins += p.text;
    if (p.op === 0 && !inRun) {
      flush();
      const last = out.at(-1);
      if (last?.op === 0) last.text += p.text;
      else out.push({ ...p });
    }
  });
  flush();
  return out.filter((p) => p.text);
}

export function wordDiff(a: string, b: string): Part[] {
  const x = a.match(TOKEN) ?? [];
  const y = b.match(TOKEN) ?? [];
  let s = 0;
  while (s < x.length && s < y.length && x[s] === y[s]) s++;
  let e = 0;
  while (e < x.length - s && e < y.length - s && x[x.length - 1 - e] === y[y.length - 1 - e]) e++;
  const mid = lcs(x.slice(s, x.length - e), y.slice(s, y.length - e));
  return group([{ text: x.slice(0, s).join(""), op: 0 }, ...mid, { text: x.slice(x.length - e).join(""), op: 0 }]);
}
