import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer as createHttpServer, type Server } from "node:http";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KEL_SCREENS, playerPath } from "../../../src/er/lib/kel";
import { csv, kelFixture } from "../helpers";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const STANDALONE = join(ROOT, ".next/standalone");
const DATA = mkdtempSync(join(tmpdir(), "er-labs-ui-"));
const SHOTS = mkdtempSync(join(tmpdir(), "er-labs-ui-shots-"));
process.env.DATA_DIR = DATA;

const owner = { id: "9001", name: "개최자", avatar: null };
const OWNER_SID = "ui-owner-session";
const OTHER_SID = "ui-other-session";
// 몽실봇 대역이 고를 수 있는 채널을 비워 주는 운영자와, 채널 목록 요청에 실패하는 운영자
const EMPTY = { id: "9003", name: "채널 없는 운영자", sid: "ui-empty-session" };
const FAILING = { id: "9004", name: "목록 실패 운영자", sid: "ui-fail-session" };
const GUILDS = [
  { id: "200000000000000001", name: "시험 서버", channels: [{ id: "100000000000000001", name: "결과-a조" }, { id: "100000000000000002", name: "결과-b조" }, { id: "100000000000000003", name: "공지" }] },
  { id: "200000000000000002", name: "두 번째 서버", channels: [{ id: "100000000000000004", name: "대회-결과" }] },
];
const LONG_TEAM = "아주아주긴팀이름입니다정말로";
const TEAMS = [LONG_TEAM, "모래성", "번개팀", "새벽길", "은하수", "파도", "단풍", "등대"];

let server: ChildProcess;
let cutApi: Server;
let botApi: Server;
let base = "";
let browser: Browser;
let code = "";
let invite = "";
let upCode = "";
let upKey = "";

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });
}

async function seed() {
  const { db } = await import("../../../src/er/server/db");
  const t = await import("../../../src/er/server/tournament");
  const conn = db();
  conn.prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(owner.id, owner.name, Date.now());
  conn
    .prepare("INSERT INTO sessions(hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(createHash("sha256").update(OWNER_SID).digest("hex"), owner.id, Date.now() + 864e5);
  conn.prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run("9002", "다른 사람", Date.now());
  conn.prepare("INSERT INTO sessions(hash, user_id, expires_at) VALUES (?, ?, ?)").run(createHash("sha256").update(OTHER_SID).digest("hex"), "9002", Date.now() + 864e5);
  for (const u of [EMPTY, FAILING]) {
    conn.prepare("INSERT INTO users(id, name, avatar, updated_at) VALUES (?, ?, NULL, ?)").run(u.id, u.name, Date.now());
    conn.prepare("INSERT INTO sessions(hash, user_id, expires_at) VALUES (?, ?, ?)").run(createHash("sha256").update(u.sid).digest("hex"), u.id, Date.now() + 864e5);
  }
  kelFixture(DATA);
  code = t.createTournament(owner, {
    name: "조별 예선 아주 긴 대회 이름을 넣어서 줄바꿈 확인하기",
    mode: "checkpoint",
    preset: "masters",
    plannedRounds: 12,
    groupCount: 2,
    rules: { advance: 4 },
  });
  const files = Array.from({ length: 8 }, (_, r) => {
    const order = TEAMS.map((_, i) => TEAMS[(i + r * 3) % TEAMS.length]);
    return { name: `r${r + 1}.csv`, text: csv(500 + r, order.map((team, i) => ({ team, place: i + 1, ks: (r + i * 2) % 9 }))) };
  });
  t.applyOp(code, owner, { op: "add_csv", group: 0, files });
  t.applyOp(code, owner, { op: "add_penalty", group: 0, team: "모래성", round: 2, kind: "rule", points: 3, reason: "지각" });
  for (const u of [EMPTY, FAILING]) t.acceptInvite(t.createInvite(code, owner), { ...u, avatar: null });
  invite = t.createInvite(code, owner);
  // A조는 디스코드 채널에 연결하고 마지막 결과를 형식 오류로, B조는 연결 안 된 상태로 둠
  t.setDiscordLinks(code, owner.id, [{ group: "A", channelId: "100000000000000001", guild: "시험 서버", channel: "결과-a조" }]);
  conn.prepare("UPDATE discord_links SET last_at = ?, last_status = 'invalid', last_round = NULL, last_user = ? WHERE channel_id = ?").run(Date.now() - 300_000, owner.name, "100000000000000001");
  conn.prepare("UPDATE rounds SET discord = 1 WHERE tournament_id = (SELECT id FROM tournaments WHERE code = ?) AND group_idx = 0 AND round_no <= 2").run(code);
  upCode = t.createTournament(owner, { name: "자동 업로드", mode: "points", preset: "masters", plannedRounds: 4, groupCount: 2 });
  upKey = t.issueUploadKey(upCode, owner, 0).key;
}

beforeAll(async () => {
  if (!existsSync(join(STANDALONE, "server.js"))) throw new Error("먼저 pnpm build를 실행해주세요.");
  for (const dir of ["public", "assets"]) cpSync(join(ROOT, dir), join(STANDALONE, dir), { recursive: true });
  cpSync(join(ROOT, ".next/static"), join(STANDALONE, ".next/static"), { recursive: true });
  await seed();
  // 이터컷 예측은 몽실봇 /api/cut 대신 고정 응답을 받음
  const cut = readFileSync(join(ROOT, "test/er/fixtures/cut.json"));
  cutApi = createHttpServer((_, res) => res.writeHead(200, { "content-type": "application/json" }).end(cut));
  const cutPort = await freePort();
  await new Promise<void>((r) => cutApi.listen(cutPort, "127.0.0.1", r));
  // 몽실봇 대역. 채널 목록은 사용자마다 있음, 비었음, 실패로 나누고 변경 알림은 받기만 함
  botApi = createHttpServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://bot");
    if (req.method === "POST" && url.pathname === "/api/t/changed") return res.writeHead(202).end();
    if (url.pathname !== "/api/t/channels") return res.writeHead(404).end();
    const user = url.searchParams.get("user");
    if (user === FAILING.id) return res.writeHead(500).end();
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ guilds: user === owner.id ? GUILDS : [] }));
  });
  const botPort = await freePort();
  await new Promise<void>((r) => botApi.listen(botPort, "127.0.0.1", r));
  const port = await freePort();
  base = `http://localhost:${port}`;
  // 운영 .env가 섞이지 않게 환경 변수를 직접 지정
  server = spawn(process.execPath, ["server.js"], {
    cwd: STANDALONE,
    env: { NODE_ENV: "production", PATH: process.env.PATH ?? "", PORT: String(port), HOSTNAME: "127.0.0.1", BASE_URL: base, DATA_DIR: DATA, DISCORD_CLIENT_ID: "1111", JOBS: "0", KEL_OWNER_ID: owner.id, CUT_API: `http://127.0.0.1:${cutPort}/api/cut`, BOT_API_URL: `http://127.0.0.1:${botPort}` },
    stdio: "ignore",
  });
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${base}/api/health`).then((r) => r.ok).catch(() => false)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  server?.kill();
  cutApi?.close();
  botApi?.close();
  rmSync(DATA, { recursive: true, force: true });
  if (readdirSync(SHOTS).length === 0) rmSync(SHOTS, { recursive: true });
});

type Screen = { name: string; path: () => string; login?: boolean | "other" | "empty" | "fail"; tab?: string; status?: number };

const SID = { other: OTHER_SID, empty: EMPTY.sid, fail: FAILING.sid } as const;

const SCREENS: Screen[] = [
  { name: "Labs", path: () => "/" },
  { name: "점수 계산", path: () => "/er/score" },
  { name: "이터컷 예측", path: () => "/er/cut" },
  { name: "이터컷 예측 RP 주소", path: () => "/er/cut?rp=9050" },
  { name: "점수 계산 로그인", path: () => "/er/score", login: true },
  { name: "처리방침", path: () => "/privacy" },
  { name: "예시 대회 선수 기록", path: () => "/er/example/a", tab: "선수 기록" },
  { name: "대회 보기", path: () => `/er/t/${code}/a` },
  { name: "대회 운영", path: () => `/er/t/${code}/a`, login: true },
  { name: "대회 운영 라운드별 점수", path: () => `/er/t/${code}/a`, login: true, tab: "라운드별 점수" },
  { name: "빈 조 운영", path: () => `/er/t/${code}/b`, login: true },
  { name: "운영자와 설정", path: () => `/er/t/${code}/manage`, login: true },
  { name: "운영자와 설정 채널 없음", path: () => `/er/t/${code}/manage`, login: "empty" },
  { name: "운영자와 설정 채널 목록 실패", path: () => `/er/t/${code}/manage`, login: "fail" },
  { name: "초대", path: () => `/er/i/${invite}` },
  { name: "없는 대회", path: () => "/er/t/ZZZZZZ/a", status: 404 },
  { name: "없는 페이지", path: () => "/nope", status: 404 },
  { name: "KEL 기록", path: () => "/er/kel", login: true },
  { name: "KEL 챔피언십 진출 확률", path: () => "/er/kel/odds", login: true },
  { name: "KEL 챔피언십 진출 확률 서킷 2 승자조 뒤", path: () => "/er/kel/odds?c=2&s=3", login: true },
  { name: "KEL 포맷과 규칙", path: () => "/er/kel/rules", login: true },
  { name: "KEL 서킷별 순위", path: () => "/er/kel/circuits", login: true },
  { name: "KEL 결승 라운드별 점수", path: () => "/er/kel/finals", login: true },
  { name: "KEL 팀 성향", path: () => "/er/kel/teams", login: true },
  { name: "KEL 팀 성향 결승 운영", path: () => "/er/kel/teams?s=finals&v=ops", login: true },
  { name: "KEL 시작 지역과 사망 지역", path: () => "/er/kel/regions", login: true },
  { name: "KEL 선수 카드", path: () => playerPath("선수4-0"), login: true },
  { name: "KEL 선수 카드 처음", path: () => "/er/kel/players", login: true },
  { name: "KEL 선수 카드 잡은 상대", path: () => playerPath("선수2-0"), login: true },
  { name: "KEL 역할", path: () => "/er/kel/roles", login: true },
  { name: "KEL 처치 관계", path: () => "/er/kel/kills", login: true },
  { name: "KEL 실험체", path: () => "/er/kel/characters", login: true },
  { name: "KEL 실험체 평균 순위 순", path: () => "/er/kel/characters?sort=place", login: true },
  { name: "KEL 실험체 빌드", path: () => "/er/kel/characters?view=build", login: true },
  { name: "KEL 실험체 빌드 나딘", path: () => "/er/kel/characters?view=build&c=Nadine", login: true },
  { name: "KEL 실험체 빌드 없는 실험체", path: () => "/er/kel/characters?view=build&c=nope", login: true },
  { name: "KEL 3인 조합", path: () => "/er/kel/comps", login: true },
  { name: "KEL 한 게임 기록", path: () => "/er/kel/records", login: true },
  { name: "KEL 한 게임 기록 실험체별", path: () => "/er/kel/records?view=characters", login: true },
  { name: "KEL 한 게임 기록 부진한 기록", path: () => "/er/kel/records?view=low", login: true },
  { name: "KEL 기록 로그아웃", path: () => "/er/kel" },
  { name: "없는 KEL 화면 다른 계정", path: () => "/er/kel/calc", login: "other", status: 404 },
];

const KEL_LIST = Object.values(KEL_SCREENS);
// 404 화면에도 er 레이아웃 설명의 "2026 KEL 기록"이 나와 공개하지 않은 화면 제목만 찾음
const HIDDEN_TITLES = new RegExp(KEL_LIST.filter((s) => !s.public).map((s) => s.title).join("|") || "(?!)");

type Problems = { overflow: number; undefinedClass: string[]; unstyled: string[]; nativeCheck: string[] };

function inspect(): Problems {
  const defined = new Set<string>();
  const collect = (rule: CSSRule) => {
    const sel = (rule as CSSStyleRule).selectorText;
    if (sel) for (const m of sel.matchAll(/\.((?:\\.|[\w-])+)/g)) defined.add(m[1].replace(/\\(.)/g, "$1"));
    for (const child of (rule as CSSGroupingRule).cssRules ?? []) collect(child);
  };
  for (const sheet of document.styleSheets) for (const rule of sheet.cssRules) collect(rule);
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };
  const label = (el: Element) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
  const undefinedClass = new Set<string>();
  for (const el of document.body.querySelectorAll("[class]")) {
    if (!visible(el)) continue;
    for (const c of el.classList) if (!defined.has(c)) undefinedClass.add(`.${c} ${label(el)}`);
  }
  const unstyled: string[] = [];
  for (const el of document.querySelectorAll("button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden])")) {
    if (!visible(el)) continue;
    const border = getComputedStyle(el).borderTopStyle;
    if (border === "outset" || border === "inset") unstyled.push(label(el));
  }
  // noValidate 없는 폼의 검증 속성은 제출할 때 브라우저 기본 말풍선을 띄움
  const nativeCheck = [...document.forms]
    .filter((f) => !f.noValidate)
    .flatMap((f) => [...f.elements].filter((el) => el.matches("[required], [pattern], [min], [max], [step], [type=email], [type=url], [type=number]")).map(label));
  return { overflow: document.documentElement.scrollWidth - innerWidth, undefinedClass: [...undefinedClass], unstyled, nativeCheck };
}

async function open(screen: Screen, width: number, theme: "dark" | "light"): Promise<{ page: Page; errors: string[]; status: number }> {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  if (screen.login) await ctx.addCookies([{ name: "er_session", value: screen.login === true ? OWNER_SID : SID[screen.login], url: base }]);
  await ctx.addInitScript((t) => localStorage.setItem("labs-theme", t), theme);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error" && !(screen.status === 404 && m.text().includes("404"))) errors.push(m.text());
  });
  const res = await page.goto(base + screen.path(), { waitUntil: "networkidle" });
  if (screen.tab) await page.getByRole("tab", { name: screen.tab }).click();
  await page.evaluate(() => document.fonts.ready);
  return { page, errors, status: res?.status() ?? 0 };
}

describe("화면 점검", () => {
  // 동시 실행 테스트라 expect는 테스트 문맥에서 받음
  for (const screen of SCREENS) {
    for (const width of [390, 1440]) {
      for (const theme of ["dark", "light"] as const) {
        it.concurrent(`${screen.name} ${width} ${theme}`, async ({ expect }) => {
          const { page, errors, status } = await open(screen, width, theme);
          try {
            expect(status).toBe(screen.status ?? 200);
            expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
            const p = await page.evaluate(inspect);
            expect(p, "가로 넘침, 정의 없는 클래스, 브라우저 기본 모양 컨트롤, 브라우저 기본 검증").toEqual({ overflow: 0, undefinedClass: [], unstyled: [], nativeCheck: [] });
            expect(errors).toEqual([]);
          } catch (e) {
            await page.screenshot({ path: join(SHOTS, `${screen.name}-${width}-${theme}.png`), fullPage: true });
            throw new Error(`${e instanceof Error ? e.message : e}\n캡처: ${SHOTS}`);
          } finally {
            await page.context().close();
          }
        });
      }
    }
  }

  it("이터컷 예측에 RP를 넣으면 진단이 좁은 화면 안에 나온다", async () => {
    const screen = SCREENS.find((x) => x.name === "이터컷 예측")!;
    const { page, errors } = await open(screen, 390, "dark");
    await page.fill("#my-rp", "9050");
    await expect(page.getByText("가능성").first().isVisible()).resolves.toBe(true);
    await page.locator("svg[role=img]").hover({ position: { x: 200, y: 120 } });
    const p = await page.evaluate(inspect);
    await page.context().close();
    expect(p).toEqual({ overflow: 0, undefinedClass: [], unstyled: [], nativeCheck: [] });
    expect(errors).toEqual([]);
  });

  it("이터컷 예측 주소의 rp 값으로 진단이 바로 나오고, 미리보기 이미지가 열린다", async () => {
    const { page, errors } = await open(SCREENS.find((x) => x.name === "이터컷 예측 RP 주소")!, 1440, "dark");
    await expect(page.inputValue("#my-rp")).resolves.toBe("9050");
    await expect(page.getByText("가능성").first().isVisible()).resolves.toBe(true);
    const og = await page.getAttribute('meta[property="og:image"]', "content");
    await page.context().close();
    expect(errors).toEqual([]);
    const res = await fetch(new URL(new URL(og!).pathname + new URL(og!).search, base));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
  });

  it("공개한 KEL 화면은 누구나 열리고 sitemap에 있으며, 공개하지 않은 화면은 운영자 말고는 제목 없이 404가 나간다", async () => {
    const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
    for (const { path, public: open } of KEL_LIST) {
      for (const sid of [null, OTHER_SID]) {
        const res = await fetch(base + path, { headers: sid ? { cookie: `er_session=${sid}` } : {} });
        const html = await res.text();
        expect([path, sid, res.status]).toEqual([path, sid, open ? 200 : 404]);
        if (open) expect(html).not.toMatch(/<meta name="robots" content="noindex/);
        else expect(html).not.toMatch(HIDDEN_TITLES);
      }
      const res = await fetch(base + path, { headers: { cookie: `er_session=${OWNER_SID}` } });
      expect([path, res.status]).toEqual([path, 200]);
      if (!open) expect(await res.text()).toMatch(/<meta name="robots" content="noindex, nofollow"/);
      expect([path, sitemap.includes(`${base}${path}<`)]).toEqual([path, open]);
    }
    const calc = await fetch(`${base}/er/kel/calc`, { headers: { cookie: `er_session=${OWNER_SID}` } });
    expect(calc.status).toBe(404);
  });

  it("실험체 빌드 탭은 누구나 열리고 sitemap에 있다", async () => {
    for (const sid of [null, OTHER_SID]) {
      const headers: Record<string, string> = sid ? { cookie: `er_session=${sid}` } : {};
      const html = await fetch(`${base}/er/kel/characters`, { headers }).then((r) => r.text());
      expect([sid, html.includes("view=build")]).toEqual([sid, true]);
      const build = await fetch(`${base}/er/kel/characters?view=build`, { headers });
      expect([sid, build.status]).toEqual([sid, 200]);
    }
    const sitemap = await fetch(`${base}/sitemap.xml`).then((r) => r.text());
    expect(sitemap).toContain(`${base}/er/kel/characters?view=build<`);
  });

  it("업로드 API는 로그인과 Origin 없이 키로만 받고, 틀린 키는 본문 없이 404", async () => {
    const send = (key: string, gameId: number, headers: Record<string, string> = {}) =>
      fetch(`${base}/api/upload/${upCode}/a`, { method: "POST", headers: { "x-upload-key": key, "content-type": "text/csv", ...headers }, body: csv(gameId, [{ team: "가", place: 1, ks: 1 }]) });
    const ok = await send(upKey, 9101, { origin: "https://evil.example" });
    expect([ok.status, await ok.json()]).toEqual([200, { status: "added", message: "A조 1라운드에 1팀 기록을 추가했습니다." }]);
    const again = await send(upKey, 9101);
    expect(again.status).toBe(409);
    const wrong = await send("nope", 9102);
    expect([wrong.status, await wrong.text()]).toEqual([404, ""]);
    const other = await fetch(`${base}/api/upload/${upCode}/b`, { method: "POST", headers: { "x-upload-key": upKey }, body: "x" });
    expect(other.status).toBe(404);
    // 일반 쓰기 API는 그대로 로그인과 Origin을 요구함
    const op = await fetch(`${base}/api/t/${upCode}`, { method: "POST", headers: { "x-upload-key": upKey, "content-type": "application/json" }, body: JSON.stringify({ op: "delete_round", id: 1 }) });
    expect(op.status).toBe(403);
  });

  it("관리 화면의 디스코드 채널은 봇 목록에서 고르고, 목록이 없으면 명령어를 보여 준다", async () => {
    const manage = (login: Screen["login"], path = () => `/er/t/${code}/manage`) => open({ name: "관리", path, login }, 1440, "dark");
    const owned = await manage(true);
    const a = owned.page.locator("#dc-h ~ ul select").first();
    await expect(a.inputValue()).resolves.toBe("100000000000000001");
    await expect(owned.page.locator("#dc-h ~ ul select").nth(1).inputValue()).resolves.toBe("");
    await expect(a.locator("optgroup").evaluateAll((els) => els.map((e) => e.getAttribute("label")))).resolves.toEqual(["시험 서버", "두 번째 서버"]);
    await owned.page.context().close();
    for (const [login, text] of [["empty", "고를 수 있는 채널이 없습니다."], ["fail", "채널 목록을 불러오지 못했습니다."]] as const) {
      const { page, errors } = await manage(login);
      await expect(page.getByText(text).isVisible()).resolves.toBe(true);
      await expect(page.locator("#dc-h ~ ul code").allTextContents()).resolves.toEqual([`/대회 ${code} B`]);
      await expect(page.getByRole("link", { name: "몽실봇 초대" }).getAttribute("href")).resolves.toBe("https://bot.mongsil.dev/invite");
      await page.context().close();
      expect(errors).toEqual([]);
    }
    // 고르면 바로 저장하고, 대회 화면 운영 도구 줄에 연결한 채널이 나옴
    const up = await manage(true, () => `/er/t/${upCode}/manage`);
    await up.page.locator("#dc-h ~ ul select").nth(1).selectOption("100000000000000004");
    await expect(up.page.getByText("B조를 #대회-결과에 연결했습니다.").waitFor()).resolves.toBeUndefined();
    await up.page.goto(`${base}/er/t/${upCode}/b`, { waitUntil: "networkidle" });
    await expect(up.page.getByRole("link", { name: "디스코드 #대회-결과" }).getAttribute("href")).resolves.toBe(`/er/t/${upCode}/manage#dc-h`);
    await up.page.goto(`${base}/er/t/${upCode}/a`, { waitUntil: "networkidle" });
    await expect(up.page.getByRole("link", { name: "디스코드 연결 안 됨" }).isVisible()).resolves.toBe(true);
    await up.page.context().close();
  });

  it("방송 화면은 1920x1080 안에 들어간다", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/er/t/${code}/a/overlay?scale=2`, { waitUntil: "networkidle" });
    const box = await page.locator(".ov").boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(1080);
    await ctx.close();
  });

  it("키보드로 옮긴 초점이 화면에 표시된다", async () => {
    const { page } = await open(SCREENS.find((s) => s.name === "대회 운영")!, 1440, "dark");
    const missing: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        const shown = s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0;
        return shown ? null : `${el.tagName.toLowerCase()} "${(el.textContent ?? el.getAttribute("aria-label") ?? "").trim().slice(0, 30)}"`;
      });
      if (r) missing.push(r);
    }
    await page.context().close();
    expect(missing).toEqual([]);
  });
});
