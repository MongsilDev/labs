// 대회 결과 메시지 구성 시안(A, B, C)과 점수 표기 시안(F1, F2, F3)을 PNG로 그림
// 실행: node mock/result-message/render.mjs
// 순위 이미지는 src/er/server/round-og.tsx의 roundImage와 같은 색, 글꼴, 크기를 HTML로 옮겨 Playwright로 캡처함
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

// 레포에 playwright 의존성이 없어 전역 설치본을 씀
const { chromium } = createRequire(import.meta.url)("playwright");

const OUT = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(OUT, "../..");
const TMP = join(process.env.MOCK_TMP ?? tmpdir(), "result-message-mock");
mkdirSync(TMP, { recursive: true });

// ---------- 가짜 대회 자료 ----------

const PLACEMENT_POINTS = [10, 7, 5, 4, 3, 2, 1, 0];
const TEAMS = ["팀 하나", "팀 둘", "팀 셋", "팀 넷", "팀 다섯", "팀 여섯", "팀 일곱", "팀 여덟"];
// 라운드마다 팀 순서대로 [게임 순위, 킬 점수]
const ROUNDS = [
  [[1, 3], [3, 1], [2, 2], [5, 1.5], [4, 2], [6, 1.5], [7, 2.5], [8, 0.5]],
  [[2, 2.5], [1, 1], [4, 1.5], [3, 1.5], [6, 1], [5, 2], [7, 1.5], [8, 1]],
  [[4, 2], [2, 1.5], [1, 3], [6, 1], [3, 2.5], [7, 0.5], [5, 1], [8, 0.5]],
  [[3, 1.5], [1, 3], [5, 1], [2, 2], [7, 0.5], [4, 1.5], [6, 1], [8, 0]],
];
const PLANNED = ROUNDS.length;
const NAME = "시험 대회";
const NEXT = { 3: "다음 3라운드 | 날씨 비", 2: "다음 2라운드 | 날씨 비" };
const BAN = "금지 실험체 재키, 아야";

// 총점, 킬 점수, 마지막 라운드 순위 순으로 가름(test/er/engine.test.ts의 포인트제 규칙)
function standings(played) {
  const rows = TEAMS.map((name, t) => {
    const games = ROUNDS.slice(0, played).map((r) => r[t]);
    const killScore = games.reduce((s, [, k]) => s + k, 0);
    const placement = games.reduce((s, [p]) => s + PLACEMENT_POINTS[p - 1], 0);
    return { name, killScore, placement, total: killScore + placement, last: games.at(-1)[0] };
  });
  rows.sort((a, b) => b.total - a.total || b.killScore - a.killScore || a.last - b.last);
  rows.forEach((r, i) => (r.rank = i + 1));
  if (played > 1) {
    const prev = standings(played - 1);
    rows.forEach((r) => (r.delta = prev.find((p) => p.name === r.name).rank - r.rank));
  }
  return rows;
}

function roundGame(n) {
  return TEAMS.map((name, t) => {
    const [place, killScore] = ROUNDS[n - 1][t];
    const placement = PLACEMENT_POINTS[place - 1];
    return { name, rank: place, killScore, placement, total: placement + killScore };
  }).sort((a, b) => a.rank - b.rank);
}

const meta = (played) => (played < PLANNED ? `포인트제 | ${played}/${PLANNED}라운드` : `포인트제 | ${played}라운드 | 최종`);

// ---------- 순위 이미지(roundImage와 같은 값) ----------

const C = {
  bg: "#0a0d14",
  panel: "#1a2130",
  line: "#232a38",
  text: "#e8edf5",
  text2: "#aab3c5",
  text3: "#7c879c",
  accent: "#26f1f6",
  gold: "#ffd621",
  up: "#4ade80",
  down: "#ff6b6b",
};
const ROW = 60;
const PAD = 32;
const HEAD = 100;
const COL_HEAD = 36;
// format.ts의 num
const num = (v) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

const fontFace = ["Medium", "Bold", "ExtraBold"]
  .map((w, i) => `@font-face{font-family:Pretendard;font-weight:${[500, 700, 800][i]};src:url("${pathToFileURL(join(ROOT, `assets/fonts/Pretendard-${w}.otf`))}")}`)
  .join("");

// style: f3 지금 그대로, f2 0.5가 있는 열은 소수 한 자리, f1 순위 점수 열과 정수 자리 맞춤, game 한 라운드 게임 순위
function rankHtml({ rows, metaText, style, showDelta }) {
  const f1 = style === "f1";
  const game = style === "game";
  const cols = [];
  if (f1 || game) cols.push({ key: "placement", head: "순위 점수", w: 90, size: 26, weight: 700, color: C.text2, frac: false });
  // F1은 머리글을 정수 자리 위에 두려고 소수 칸만큼 넓힘
  cols.push({ key: "killScore", head: "킬 점수", w: f1 ? 104 : 82, size: 26, weight: 700, color: C.text2, frac: f1 });
  cols.push({ key: "total", head: "총점", w: 116, size: 33, weight: 800, color: C.text, frac: f1 });
  if (!game) cols.push({ key: "delta", head: showDelta ? "변동" : "", w: 52, size: 22, weight: 700 });
  const fixed = {};
  if (style === "f2") for (const c of cols) fixed[c.key] = rows.some((r) => !Number.isInteger(r[c.key]));

  const cell = (c, r) => {
    if (c.key === "delta") {
      const d = showDelta ? r.delta : 0;
      return `<span class="c" style="width:${c.w}px;font-size:${c.size}px;font-weight:700;color:${d > 0 ? C.up : C.down}">${d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : ""}</span>`;
    }
    const v = r[c.key];
    const base = `width:${c.w}px;font-size:${c.size}px;font-weight:${c.weight};color:${c.color}`;
    if (f1) {
      const [int, frac] = num(v).split(".");
      return `<span class="c tnum" style="${base}"><span class="int">${int}</span>${c.frac ? `<span class="frac" data-size="${c.size}">${frac ? `.${frac}` : ""}</span>` : ""}</span>`;
    }
    const text = fixed[c.key] ? v.toFixed(1) : num(v);
    return `<span class="c" style="${base}"><span class="int">${text}</span></span>`;
  };

  const body = rows
    .map(
      (r) => `<div class="row">
  <div style="display:flex;width:54px"><span class="badge" style="background:${r.rank === 1 ? C.gold : C.panel};color:${r.rank === 1 ? "#111" : C.text}">${r.rank}</span></div>
  <div class="name">${r.name}</div>
  ${cols.map((c) => cell(c, r)).join("")}
</div>`,
    )
    .join("");

  const height = PAD * 2 + HEAD + COL_HEAD + rows.length * ROW;
  return `<!doctype html><meta charset="utf-8"><style>${fontFace}
*{box-sizing:border-box;margin:0}
body{background:${C.bg}}
#img{display:flex;flex-direction:column;width:720px;height:${height}px;padding:${PAD}px;background:${C.bg};color:${C.text};font-family:Pretendard}
.row{display:flex;align-items:center;height:${ROW}px;border-bottom:1px solid ${C.line}}
.colhead{display:flex;align-items:flex-end;height:${COL_HEAD}px;padding-bottom:6px;font-size:21px;font-weight:700;color:${C.text3};border-bottom:1px solid ${C.line}}
.c{display:flex;justify-content:flex-end;white-space:nowrap}
.tnum{font-variant-numeric:tabular-nums}
.frac{display:inline-block;text-align:left}
.badge{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:7px;font-size:21px;font-weight:800}
.name{display:flex;flex:1;min-width:0;font-size:29px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
</style>
<div id="img">
  <div style="display:flex;flex-direction:column;height:${HEAD}px">
    <span style="font-size:36px;font-weight:800">${NAME}</span>
    <span style="font-size:24px;font-weight:500;color:${C.text2};margin-top:8px">${metaText}</span>
  </div>
  <div style="display:flex;flex-direction:column">
    <div class="colhead"><span style="flex:1"></span>${cols.map((c) => `<span class="c" style="width:${c.w}px">${c.head}${c.frac ? `<span class="frac" data-size="${c.size}"></span>` : ""}</span>`).join("")}</div>
    ${body}
  </div>
</div>`;
}

const cumulative = (played, style = "f3") => rankHtml({ rows: standings(played), metaText: meta(played), style, showDelta: played > 1 });
const gameImage = (n) => rankHtml({ rows: roundGame(n), metaText: `${n}라운드 게임 순위`, style: "game", showDelta: false });

// ---------- 디스코드 화면 ----------

const D = {
  rail: "#1e1f22",
  side: "#2b2d31",
  chat: "#313338",
  line: "#3f4147",
  text: "#dbdee1",
  head: "#f2f3f5",
  muted: "#949ba4",
  sub: "#b5bac1",
  box: "#2b2d31",
  button: "#4e5058",
  input: "#383a40",
  blurple: "#5865f2",
  link: "#00a8fc",
};

const ext = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
const caret = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`;

// 메시지 부품. img는 {src, w, h}
const md = {
  h3: (t) => `<div class="h3">${t}</div>`,
  sub: (t) => `<div class="subtext">${t}</div>`,
};
const text = (...lines) => `<div class="td">${lines.join("")}</div>`;
const gallery = (imgs) =>
  imgs.length === 1
    ? `<div class="gallery"><img class="rank" data-rows="8" src="${imgs[0].src}" style="width:100%;aspect-ratio:${imgs[0].w}/${imgs[0].h}"></div>`
    : `<div class="gallery two">${imgs.map((i) => `<img class="rank" data-rows="8" src="${i.src}" style="object-fit:cover">`).join("")}</div>`;
const linkButton = `<span class="btn">순위표${ext}</span>`;
const select = (open, options) =>
  `<div class="select${open ? " open" : ""}"><span>라운드 순위</span>${caret}${open ? `<div class="menu">${options.map((o, i) => `<div class="opt${i === 1 ? " hover" : ""}">${o}</div>`).join("")}</div>` : ""}</div>`;

// 운영자가 올리는 게임 결과 CSV. 메시지 수를 셀 때는 봇 메시지만 셈
const upload = (n, time) => `<div class="msg">
  <div class="avatar op">운</div>
  <div class="body">
    <div class="author"><span class="name">운영자</span><span class="time">${time}</span></div>
    <div class="file"><span class="icon"></span><span><b>${n}라운드.csv</b><small>2.1 KB</small></span></div>
  </div>
</div>`;
const UPLOAD = { 1: "오늘 오후 8:22", 2: "오늘 오후 8:49", 3: "오늘 오후 9:16", 4: "오늘 오후 9:45" };

function message({ container, rows = [], time, cont = false }) {
  return `<div class="msg${cont ? " cont" : ""}" data-msg>
  ${cont ? `<span class="hover-time">${time.split(" ").at(-1)}</span>` : `<div class="avatar">몽</div>`}
  <div class="body">
    ${cont ? "" : `<div class="author"><span class="name">몽실봇</span><span class="app">앱</span><span class="time">${time}</span></div>`}
    <div class="container">${container}</div>
    ${rows.map((r) => `<div class="arow">${r}</div>`).join("")}
  </div>
</div>`;
}

const chromeCss = (mobile) => `${fontFace}
*{box-sizing:border-box;margin:0}
body{font-family:Pretendard;color:${D.text};background:${D.chat};overflow:hidden}
.msg{display:flex;gap:16px;padding:${mobile ? "12px 12px 6px" : "16px 48px 2px 16px"};position:relative}
.msg.cont{padding-top:6px}
.avatar{flex:none;width:40px;height:40px;border-radius:50%;background:${D.blurple};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.hover-time{flex:none;width:40px}
.body{min-width:0;flex:1}
.author{display:flex;align-items:center;gap:6px;height:22px;margin-bottom:2px}
.author .name{font-weight:700;color:${D.head};font-size:16px}
.app{background:${D.blurple};color:#fff;font-size:11px;font-weight:700;border-radius:4px;padding:1px 5px;line-height:15px}
.time{color:${D.muted};font-size:12px;margin-left:2px}
.container{background:${D.box};border:1px solid ${D.line};border-radius:8px;padding:${mobile ? 12 : 16}px;display:flex;flex-direction:column;gap:8px;max-width:${mobile ? "none" : "600px"};margin-top:4px}
.td{display:flex;flex-direction:column}
.h3{font-size:${mobile ? 18 : 20}px;font-weight:700;color:${D.head};line-height:1.35;margin-bottom:4px}
.subtext{font-size:12.5px;color:${D.muted};line-height:1.4}
.gallery{border-radius:6px;overflow:hidden;display:flex}
.gallery img{display:block}
.gallery.two{gap:4px}
.gallery.two img{flex:1;min-width:0;aspect-ratio:1/1}
.arow{display:flex;gap:8px;margin-top:8px}
.btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:8px;background:${D.button};color:#fff;font-size:14px;font-weight:500}
.select{position:relative;display:flex;align-items:center;justify-content:space-between;width:${mobile ? "100%" : "400px"};height:40px;padding:0 10px 0 12px;border-radius:8px;background:${D.rail};border:1px solid ${D.rail};color:${D.muted};font-size:15px}
.select.open{border-color:${D.link}}
.menu{position:absolute;left:-1px;right:-1px;bottom:44px;background:${D.side};border:1px solid ${D.rail};border-radius:8px;padding:4px;box-shadow:0 8px 16px rgba(0,0,0,.24);z-index:2}
.opt{padding:10px 8px;border-radius:4px;color:${D.text};font-size:15px}
.opt.hover{background:#404249;color:#fff}
.avatar.op{background:#80848e}
.file{display:flex;align-items:center;gap:10px;width:${mobile ? "100%" : "400px"};margin-top:4px;padding:12px;border-radius:8px;background:${D.box};border:1px solid ${D.line}}
.file .icon{width:24px;height:30px;border-radius:3px;background:${D.muted}}
.file b{display:block;color:${D.link};font-size:15px;font-weight:500}
.file small{color:${D.muted};font-size:12px}
`;

function desktop({ messages, channel = "대회-결과" }) {
  const channels = ["공지", "대회-결과", "대회-잡담"];
  return `<!doctype html><meta charset="utf-8"><style>${chromeCss(false)}
#app{display:flex;width:1440px;height:900px}
.rail{width:72px;background:${D.rail};display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:12px}
.srv{width:48px;height:48px;border-radius:50%;background:${D.chat}}
.srv.on{border-radius:16px;background:${D.blurple}}
.sep{width:32px;height:2px;background:${D.line}}
.side{width:240px;background:${D.side};display:flex;flex-direction:column}
.side h2{height:48px;display:flex;align-items:center;padding:0 16px;font-size:16px;font-weight:700;color:${D.head};border-bottom:1px solid ${D.rail}}
.cat{padding:18px 16px 4px;font-size:12px;font-weight:700;color:${D.muted}}
.ch{margin:1px 8px;padding:6px 8px;border-radius:4px;color:${D.muted};font-size:16px;font-weight:500}
.ch.on{background:#404249;color:#fff}
.user{margin-top:auto;height:52px;background:#232428;display:flex;align-items:center;gap:8px;padding:0 8px}
.user .av{width:32px;height:32px;border-radius:50%;background:#80848e}
.user span{font-size:14px;color:${D.head};font-weight:600}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.top{height:48px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid ${D.rail};font-weight:700;color:${D.head};font-size:16px;gap:8px}
.top .hash{color:${D.muted};font-size:22px;font-weight:500}
.split{flex:1;display:flex;min-height:0}
.log{flex:1;display:flex;flex-direction:column;min-width:0}
.scroll{flex:1;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;padding-bottom:24px}
.box{margin:0 16px 24px;height:44px;border-radius:8px;background:${D.input};display:flex;align-items:center;padding:0 16px;color:${D.muted};font-size:15px}
.members{width:240px;background:${D.side};padding:16px 8px}
.members .cat{padding:8px 8px 4px}
.mem{display:flex;align-items:center;gap:12px;padding:6px 8px;font-size:15px;color:${D.sub}}
.mem .av{width:32px;height:32px;border-radius:50%;background:#80848e}
.mem .av.bot{background:${D.blurple}}
</style>
<div id="app">
  <div class="rail"><div class="srv"></div><div class="sep"></div><div class="srv on"></div><div class="srv"></div><div class="srv"></div></div>
  <div class="side">
    <h2>테스트 서버</h2>
    <div class="cat">채팅 채널</div>
    ${channels.map((c) => `<div class="ch${c === channel ? " on" : ""}"># ${c}</div>`).join("")}
    <div class="user"><div class="av"></div><span>운영자</span></div>
  </div>
  <div class="main">
    <div class="top"><span class="hash">#</span>${channel}</div>
    <div class="split">
      <div class="log"><div class="scroll" id="scroll">${messages.join("")}</div><div class="box">#${channel}에 메시지 보내기</div></div>
      <div class="members"><div class="cat">온라인 — 2</div><div class="mem"><div class="av bot"></div>몽실봇</div><div class="mem"><div class="av"></div>운영자</div></div>
    </div>
  </div>
</div>`;
}

function mobile({ messages, channel = "대회-결과" }) {
  return `<!doctype html><meta charset="utf-8"><style>${chromeCss(true)}
#app{display:flex;flex-direction:column;width:390px;height:844px;background:${D.chat}}
.status{height:47px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 28px 8px;font-size:15px;font-weight:600;color:#fff}
.top{height:52px;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid ${D.rail};font-weight:700;color:${D.head};font-size:17px}
.top .back{width:10px;height:10px;border-left:2.5px solid ${D.sub};border-bottom:2.5px solid ${D.sub};transform:rotate(45deg);margin-right:6px}
.top .hash{color:${D.muted};font-size:20px;font-weight:500}
.scroll{flex:1;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;padding-bottom:12px}
.bar{display:flex;align-items:center;gap:10px;padding:8px 12px 0}
.plus{width:36px;height:36px;border-radius:50%;background:${D.input}}
.box{flex:1;height:40px;border-radius:20px;background:${D.input};display:flex;align-items:center;padding:0 16px;color:${D.muted};font-size:15px}
.home{height:34px;display:flex;align-items:flex-end;justify-content:center;padding-bottom:8px}
.home span{width:134px;height:5px;border-radius:3px;background:#fff}
</style>
<div id="app">
  <div class="status"><span>9:41</span><span></span></div>
  <div class="top"><span class="back"></span><span class="hash">#</span>${channel}</div>
  <div class="scroll" id="scroll">${messages.join("")}</div>
  <div class="bar"><span class="plus"></span><div class="box">#${channel}에 메시지 보내기</div></div>
  <div class="home"><span></span></div>
</div>`;
}

// ---------- 각 안의 메시지 ----------

const nextLines = (played) => (played < PLANNED ? [md.sub(NEXT[played + 1]), md.sub(BAN)] : []);
const TIME = { 1: "오늘 오후 8:24", 2: "오늘 오후 8:51", 3: "오늘 오후 9:18", 4: "오늘 오후 9:47" };

function planA(played, img, open = false) {
  const options = ["누적 순위", ...Array.from({ length: played }, (_, i) => `${i + 1}라운드`)];
  const parts = [text(md.h3(NAME), md.sub(meta(played))), gallery([img.cum[played]])];
  if (played < PLANNED) parts.push(text(...nextLines(played)));
  // 라운드마다 이전 메시지를 지우고 새로 올려 봇 메시지는 맨 아래 하나만 남음
  const uploads = Array.from({ length: played }, (_, i) => upload(i + 1, UPLOAD[i + 1]));
  return [...uploads, message({ container: parts.join(""), rows: [select(open, options), linkButton], time: TIME[played] })];
}

function planB(played, img) {
  const notice = message({
    container: text(md.h3(NAME), md.sub(meta(played)), md.sub("이 채널에 올린 게임 결과 CSV는 순위에 반영됩니다.")),
    rows: [linkButton],
    time: "오늘 오후 7:58",
  });
  const rounds = Array.from({ length: played }, (_, i) => {
    const n = i + 1;
    // 마지막 라운드 메시지에만 다음 라운드 줄이 남음. 지난 라운드 메시지는 수정해 줄을 뺌
    const lines = n === played ? nextLines(n) : [];
    return [upload(n, UPLOAD[n]), message({ container: gallery([img.cum[n]]) + (lines.length ? text(...lines) : ""), time: TIME[n] })];
  });
  return [notice, ...rounds.flat()];
}

function planC(played, img) {
  return Array.from({ length: played }, (_, i) => {
    const n = i + 1;
    const lines = n === played ? nextLines(n) : [];
    const parts = [text(md.h3(NAME), md.sub(meta(n))), gallery([img.cum[n], img.game[n]])];
    if (lines.length) parts.push(text(...lines));
    return [upload(n, UPLOAD[n]), message({ container: parts.join(""), rows: [linkButton], time: TIME[n] })];
  }).flat();
}

// ---------- 캡처 ----------

const browser = await chromium.launch();

async function open(html, name, viewport, scale = 1) {
  const file = join(TMP, `${name}.html`);
  writeFileSync(file, html);
  const page = await browser.newPage({ viewport, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.decode()));
  });
  return page;
}

async function shotRank(html, name) {
  const page = await open(html, name, { width: 720, height: 1200 }, 1.5);
  // F1의 소수 칸은 열마다 ".5"가 들어갈 폭으로 맞춤
  const check = await page.evaluate(() => {
    // 머리글도 같은 폭을 비워 정수 자리 위에 놓음
    for (const size of new Set([...document.querySelectorAll(".frac")].map((f) => f.dataset.size))) {
      const probe = document.createElement("span");
      probe.className = "tnum";
      probe.style.cssText = `font-family:Pretendard;font-size:${size}px;font-weight:800;position:absolute;visibility:hidden`;
      probe.textContent = ".5";
      document.body.append(probe);
      const w = Math.ceil(probe.getBoundingClientRect().width);
      probe.remove();
      document.querySelectorAll(`.frac[data-size="${size}"]`).forEach((f) => (f.style.width = `${w}px`));
    }
    // 열마다 정수 자리 오른쪽 끝의 위치가 몇 가지인지 셈
    const rows = [...document.querySelectorAll(".row")];
    const n = rows[0].querySelectorAll(".c").length;
    const edges = [];
    for (let k = 0; k < n; k++) {
      const xs = rows.map((r) => {
        const c = r.querySelectorAll(".c")[k];
        const el = c.querySelector(".int");
        if (!el) return null;
        // 정수 부분의 오른쪽 끝. 소수가 붙은 글자는 정수 글자까지만 잼
        const t = el.firstChild;
        const range = document.createRange();
        const len = t.textContent.split(".")[0].length;
        range.setStart(t, 0);
        range.setEnd(t, len);
        return Math.round(range.getBoundingClientRect().right * 10) / 10;
      });
      if (xs.every((x) => x === null)) continue;
      edges.push([...new Set(xs)]);
    }
    const t1 = document.createElement("span");
    t1.style.cssText = "font-family:Pretendard;font-weight:800;font-size:40px;font-variant-numeric:tabular-nums;position:absolute";
    t1.textContent = "1111";
    const t0 = t1.cloneNode();
    t0.textContent = "0000";
    document.body.append(t1, t0);
    const tnum = t1.getBoundingClientRect().width === t0.getBoundingClientRect().width;
    t1.remove();
    t0.remove();
    return { edges, tnum };
  });
  const buf = await page.locator("#img").screenshot();
  await page.close();
  if (name) writeFileSync(join(OUT, `${name}.png`), buf);
  return { buf, check };
}

const box = async (buf) => {
  const page = await browser.newPage();
  const size = await page.evaluate(async (src) => {
    const i = new Image();
    i.src = src;
    await i.decode();
    return { w: i.naturalWidth, h: i.naturalHeight };
  }, `data:image/png;base64,${buf.toString("base64")}`);
  await page.close();
  return { src: `data:image/png;base64,${buf.toString("base64")}`, ...size };
};

async function shot300(buf, name) {
  const { src, w, h } = await box(buf);
  const html = `<!doctype html><style>*{margin:0}body{background:#000}</style><img id="i" src="${src}" style="display:block;width:300px;height:${(300 * h) / w}px">`;
  const page = await open(html, `${name}-300`, { width: 300, height: Math.ceil((300 * h) / w) });
  writeFileSync(join(OUT, `${name}-300.png`), await page.locator("#i").screenshot());
  await page.close();
}

// 한 화면에 보이는 메시지 수와, 이미지에서 다 보이는 순위 행 수
async function measure(page) {
  return page.evaluate(
    ({ PAD, HEAD, COL_HEAD, ROW }) => {
      const view = document.getElementById("scroll").getBoundingClientRect();
      const msgs = [...document.querySelectorAll("[data-msg]")];
      const visible = msgs.filter((m) => {
        const r = m.getBoundingClientRect();
        return r.bottom > view.top && r.top < view.bottom;
      });
      const whole = visible.filter((m) => m.getBoundingClientRect().top >= view.top).length;
      let rows = 0;
      for (const img of document.querySelectorAll("img.rank")) {
        const r = img.getBoundingClientRect();
        const s = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
        const off = (r.height - img.naturalHeight * s) / 2;
        for (let i = 0; i < 8; i++) {
          const top = r.top + off + (PAD + HEAD + COL_HEAD + i * ROW) * 1.5 * s;
          const bottom = top + ROW * 1.5 * s;
          if (top >= Math.max(view.top, r.top) && bottom <= Math.min(view.bottom, r.bottom)) rows++;
        }
      }
      return { messages: visible.length, whole, rows };
    },
    { PAD, HEAD, COL_HEAD, ROW },
  );
}

async function shotScreen(html, name, viewport, before) {
  const page = await open(html, name, viewport);
  if (before) await before(page);
  const m = await measure(page);
  writeFileSync(join(OUT, `${name}.png`), await page.screenshot());
  await page.close();
  return m;
}

// 점수 표기 시안: 2라운드 누적 순위
const report = {};
for (const [name, style] of [["F1", "f1"], ["F2", "f2"], ["F3", "f3"]]) {
  const { buf, check } = await shotRank(cumulative(2, style), name);
  await shot300(buf, name);
  report[name] = check;
}

// 메시지 시안에 넣는 이미지는 지금 표기(F3)로 그림
const img = { cum: {}, game: {} };
for (let n = 1; n <= PLANNED; n++) {
  img.cum[n] = await box((await shotRank(cumulative(n), "")).buf);
  img.game[n] = await box((await shotRank(gameImage(n), "")).buf);
}

// 데스크톱은 4라운드가 끝난 상태, 휴대폰은 2라운드가 끝난 상태
const D_SIZE = { width: 1440, height: 900 };
const M_SIZE = { width: 390, height: 844 };
const plans = { A: planA, B: planB, C: planC };
for (const [k, plan] of Object.entries(plans)) {
  report[`${k}-desktop`] = await shotScreen(desktop({ messages: plan(4, img) }), `${k}-desktop`, D_SIZE);
  report[`${k}-mobile`] = await shotScreen(mobile({ messages: plan(2, img) }), `${k}-mobile`, M_SIZE);
}
report["A-select"] = await shotScreen(desktop({ messages: planA(4, img, true) }), "A-select", D_SIZE);

await browser.close();
console.log(JSON.stringify(report, null, 1));
