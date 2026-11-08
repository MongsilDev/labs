import type { Glyphs } from "./hud";

// scripts/er/hud-glyphs.mjs가 KEL 중계와 내전 장면 10장에서 만든 숫자 템플릿
const g = (w: number, b64: string) => {
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const p = Float32Array.from(new Int8Array(raw.buffer), (v) => v / 400);
  let n = 0;
  for (const v of p) n += v * v;
  n = Math.sqrt(n) || 1;
  return { p: p.map((v) => v / n), w };
};

export const GLYPHS: Glyphs = {
  "0": g(7.81, "8xkmJiYiCNEfLh0WGScs/SoczcDA+SgNLB3Lv734KA8sHMu/vfkoDyscyr289ygOLBvLvr73KA0sHMm+u/goDisbzcC/+SgNJyoFBf0XLAkCKDAwMC8a1sLh8PT17szD"),
  "1": g(7.07, "3x0zODIJ0c/zHSg0NQrQ0M/Q6B41CtDQ0dDlHjUKz9DQ0egeNQrPz9DR5Rw1Cs/P0s/mHDQKz9DOz+YdNAnPz9XU6h0zDdXUAxAVLTgmEwsnPEJERENBOPwEBQYGBQX/"),
  "2": g(7.42, "DicpKiopGewQHB0bHSMsEsfHyMfF8CAewMPGwsLwICLGxtDt/hUrF+wZJy4wMSb1KDMnGQz218kyINfHxMPExTEb1MLDw8LFLyQNCQkICvcsMTIyMTEwHvX1+Pb29ffn"),
  "3": g(7.89, "ES4sLS8oDtMRIB8fHScu/MrIyMfGBjEOxcjGxMYJLwvH/Q4PDSUu9skjNTc1OB3Txu73+vUZNQbHx8PDyQowDMnFyMfHCzINAwwJDAYdNQUgNTQ0NTQhztb5+Pf88dLI"),
  "4": g(7.96, "0M/TIi331dHS0fw3J9TQ0tLSIDgF0dLPz/o0KNLU09HRGzgL0w8rCe81LdXQEDcTGjgPz9IROBEvNA4ODBs4EDk9Nzo5OT0RCAoKBwcXOBHRz8/P0RE0Dc/S0dLR5QPe"),
  "5": g(7.61, "IykqKCgpIussKR4bGxoZ5i4e08PExMPFLR3VxMTDwsQsKBcVFBL81yksLS4uMyv94eXk4+QCJRjEw8TDwvQjGsPDw8LD8yMZBQgHCAYXLBcqMzQzMzIi5ur09vf489XH"),
  "6": g(7.50, "6g8hJCQkF+AbKhsVEhMT3yoYyru7u7y+LRTNubi9vbspIhIQDwz61CwwLCoqLy7+Lxvs39v8IBcrFci5u+wcFiwXzsC/6x8ZJyYJBQASKBMLJS4vMC8d573g7/P18dDA"),
  "7": g(7.73, "NDg5ODk6OiIqKyssLC07JNfY19jUEDoj19nZ19wiOhXZ2drYDTkv8NrZ2+EqOxLk2tjXFj4p69vb2e4uOwfg2NnbFz8o6NfY2fYzOwTd2djXHz4h5NnY2dj1DN7a2NrZ"),
  "8": g(7.56, "7BQfIB0bCdUdKxYSDx8kADMTt6iq5RoSMQ3BsLHpGRAZIgP+ABIf/P8vLysuMBndJRrw6ekAIA4tELqprOcaEi0PvK6w5xoRJCcA/PoMJwz6JywtLy0Y2LPa5ujp4MSv"),
  "9": g(7.67, "+xgjIyUfANsiMRgNFSUu/zMWybu/9CUQNBbBvbr1IREvG9S/wPghECU1HxsiGiwQ7hIeHRwhNA+9uLu9wPYjDb2/vbq99iMN8gQDCAceJgIJLDIzMSsM27vw8vXx4si8"),
};
