import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, describe, expect, it } from "vitest";
import { uploadScript } from "../../src/er/server/upload-script";
import { csv } from "./helpers";

const DIR = mkdtempSync(join(tmpdir(), "er-labs-ps-"));
afterAll(() => rmSync(DIR, { recursive: true, force: true }));

const KEY = "test-key-made-up-for-tests";
const TITLE = "몽실's ‘연습’ 대회 A조";
const SCRIPT = join(DIR, "labs-upload.ps1");
writeFileSync(SCRIPT, uploadScript({ url: "http://127.0.0.1:9/api/upload/TEST01/a", key: KEY, title: TITLE }));

// Windows가 없는 곳에서는 pwsh로 점 소싱해 함수만 시험함. pwsh가 없으면 이 묶음은 건너뜀
const PWSH = (() => {
  try {
    execFileSync("pwsh", ["-NoProfile", "-Command", "1"], { stdio: "ignore" });
    return "pwsh";
  } catch {
    return null;
  }
})();

const run = promisify(execFile);
async function ps<T = unknown>(body: string): Promise<T> {
  const cmd = `$ProgressPreference = 'SilentlyContinue'; . '${SCRIPT}'; ${body}`;
  const { stdout } = await run(PWSH!, ["-NoProfile", "-NonInteractive", "-Command", cmd], { encoding: "utf8" });
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]) as T;
}
const json = (expr: string) => `(${expr}) | ConvertTo-Json -Compress`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

describe("업로드 스크립트 파일", () => {
  it("BOM과 CRLF로 내보내고 주소, 키, 제목을 채운다", () => {
    const raw = readFileSync(SCRIPT, "utf8");
    expect(raw.charCodeAt(0)).toBe(0xfeff);
    expect(raw).not.toMatch(/[^\r]\n/);
    expect(raw).not.toContain("__LABS_");
    expect(raw).toContain(`$UploadKey = '${KEY}'`);
    expect(raw).toContain("$Title = '몽실''s ‘‘연습’’ 대회 A조'");
    expect(raw).not.toMatch(/-WindowStyle|Register-ScheduledTask|Install-Module|Import-Module/);
  });
});

describe.skipIf(!PWSH)("업로드 스크립트 함수 (pwsh)", { timeout: 30_000 }, () => {
  it("따옴표가 든 대회 이름도 그대로 읽는다", async () => {
    expect(await ps(json("$Title"))).toBe(TITLE);
  });

  it("필수 열과 gameId를 확인한다", async () => {
    const good = csv(8001, [{ team: "가", place: 1, ks: 1 }]);
    expect(await ps(json(`Read-ResultCsv ${lit(good)}`))).toEqual({ Ok: true, GameId: "8001", Error: null });
    const quoted = '"teamName","tournament total score","tournament kill score",gameId\r\n"가, ""나""",1,1,8009\r\n';
    expect(await ps(json(`Read-ResultCsv ${lit(quoted)}`))).toEqual({ Ok: true, GameId: "8009", Error: null });
    const missing = good.replace("teamName", "team");
    expect(await ps(json(`Read-ResultCsv ${lit(missing)}`))).toEqual({ Ok: false, GameId: null, Error: "결과 CSV가 아닙니다. 없는 열: teamName" });
    const badId = csv(8002, [{ team: "가", place: 1, ks: 1 }]).replace(/, 8002, /g, ", 80x2, ");
    expect(await ps(json(`Read-ResultCsv ${lit(badId)}`))).toMatchObject({ Ok: false, Error: "gameId를 읽을 수 없습니다." });
    expect(await ps(json(`Read-ResultCsv ${lit("rank\r\n")}`))).toMatchObject({ Ok: false, Error: "경기 기록이 없는 파일입니다." });
  });

  it("내용 해시는 SHA-256이고, 마지막으로 보낸 경기나 같은 내용은 보내지 않는다", async () => {
    const text = csv(8003, [{ team: "가", place: 1, ks: 1 }]);
    const want = createHash("sha256").update(text).digest("hex");
    expect(await ps(json(`Get-ContentHash ([Text.Encoding]::UTF8.GetBytes(${lit(text)}))`))).toBe(want);
    const decide = (state: string, id: string, hash: string) => ps(json(`Get-SendDecision ([pscustomobject]@{ ${state} }) '${id}' '${hash}'`));
    expect(await decide("LastGameId = ''; LastHash = ''", "1", "h")).toBe("send");
    expect(await decide("LastGameId = '1'; LastHash = 'x'", "1", "h")).toBe("same-game");
    expect(await decide("LastGameId = '2'; LastHash = 'h'", "1", "h")).toBe("same-content");
    expect(await decide("LastGameId = '2'; LastHash = 'x'", "1", "h")).toBe("send");
  });

  it("상태 파일을 저장하고 다시 읽는다", async () => {
    const path = join(DIR, "state.json");
    const out = await ps(`Save-State '${path}' ([pscustomobject]@{ Folder = 'C:\\결과'; LastGameId = '9'; LastHash = 'ab' }); ${json(`Read-State '${path}'`)}`);
    expect(out).toEqual({ Folder: "C:\\결과", LastGameId: "9", LastHash: "ab" });
    expect(await ps(json(`Read-State '${join(DIR, "none.json")}'`))).toEqual({ Folder: "", LastGameId: "", LastHash: "" });
  });

  it("응답 코드별로 기록하고, 서버 오류는 다시 보내고, 폐기된 키에서는 멈춘다", async () => {
    const replies: [number, object | null][] = [];
    const got: { key: string | undefined; name: string | undefined; body: string }[] = [];
    const server = createServer(async (req: IncomingMessage, res) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      got.push({ key: req.headers["x-upload-key"] as string, name: req.headers["x-file-name"] as string, body: Buffer.concat(chunks).toString("utf8") });
      const [status, body] = replies.shift() ?? [500, null];
      res.writeHead(status, { "content-type": "application/json" }).end(body ? JSON.stringify(body) : "");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    try {
      const file = join(DIR, "GameResult_.csv");
      const state = join(DIR, "send-state.json");
      const send = async (gameId: number, ...seq: [number, object | null][]) => {
        writeFileSync(file, csv(gameId, [{ team: "가", place: 1, ks: 1 }]));
        replies.push(...seq);
        return ps<{ r: string; s: { LastGameId: string; LastHash: string } }>(
          `$UploadUrl = 'http://127.0.0.1:${port}/api/upload/TEST01/a'; $s = Read-State '${state}'; $r = Invoke-Upload '${file}' '${state}' $s @(0, 0); [pscustomobject]@{ r = $r; s = $s } | ConvertTo-Json -Compress`,
        );
      };

      const ok = await send(8101, [200, { status: "added", message: "A조 1라운드에 1팀 기록을 추가했습니다." }]);
      expect(ok.r).toBe("ok");
      expect(ok.s.LastGameId).toBe("8101");
      expect(got[0]).toMatchObject({ key: KEY, name: "GameResult_.csv" });
      expect(got[0].body).toContain("8101");

      // 같은 경기는 서버에 보내지 않음
      const before = got.length;
      expect((await send(8101)).r).toBe("skip");
      expect(got.length).toBe(before);

      expect((await send(8102, [409, { status: "duplicate", message: "이미 A조 1라운드에 올린 경기입니다." }])).s.LastGameId).toBe("8102");

      const retried = await send(8103, [503, null], [429, { status: "limited", message: "" }], [200, { status: "added", message: "추가" }]);
      expect(retried.r).toBe("ok");
      expect(got.length).toBe(before + 4);

      const failed = await send(8104, [500, null], [500, null], [500, null]);
      expect(failed).toMatchObject({ r: "failed", s: { LastGameId: "8103" } });

      const bad = await send(8105, [422, { status: "invalid", message: "결과 CSV가 아닙니다." }]);
      expect(bad.r).toBe("done");
      expect(bad.s.LastGameId).toBe("8103");

      expect((await send(8106, [404, null])).r).toBe("stop");
      expect((await send(8107, [410, { status: "ended", message: "끝난 대회입니다." }])).r).toBe("stop");
    } finally {
      server.close();
    }
  }, 60_000);

  it("서버에 닿지 못하면 Status 0으로 돌려준다", async () => {
    expect(await ps(json("(Send-Result 'http://127.0.0.1:9/x' 'k' ([byte[]]@(1))).Status"))).toBe(0);
  });
});
