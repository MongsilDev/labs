// 공식 API 요청 간격과 같은 키를 쓰는 몽실봇의 429 확인. 수집기와 경기 보관기가 함께 씀
import { execFileSync } from "node:child_process";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Pace {
  constructor(rps) {
    this.set(rps);
    this.next = 0;
    this.slowUntil = 0;
  }
  set(rps) {
    this.rps = rps;
    this.gap = 1000 / rps;
  }
  async take() {
    const now = Date.now();
    const gap = now < this.slowUntil ? this.gap * 2 : this.gap;
    const at = Math.max(now, this.next);
    this.next = at + gap;
    if (at > now) await sleep(at - now);
  }
  limited(waitMs) {
    this.slowUntil = Date.now() + 300_000;
    this.next = Math.max(this.next, Date.now() + waitMs);
  }
}

/** 몽실봇 로그의 마지막 429 대기 시각, 확인하지 못하면 null */
export function botLast429() {
  try {
    const line = execFileSync("docker", ["exec", "bots", "sh", "-c", "grep 'API Rate limit' /var/log/supervisor/mongsil-bot.log | tail -1"], {
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, PATH: `/Applications/OrbStack.app/Contents/MacOS/xbin:${process.env.PATH}` },
    }).trim();
    return line ? Date.parse(`${line.slice(0, 19).replace(" ", "T")}+09:00`) : 0;
  } catch {
    return null;
  }
}
