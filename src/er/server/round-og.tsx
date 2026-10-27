import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { num } from "@/er/lib/format";
import { glyphs, keepGlyphs } from "@/glyphs";
import type { Board, BoardRow } from "./board";

const font = (w: string) => readFile(join(process.cwd(), `assets/fonts/Pretendard-${w}.otf`));
const fonts = Promise.all([font("Medium"), font("Bold"), font("ExtraBold")]);
const covered = fonts.then(([medium]) => glyphs(medium));

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

// 디스코드 모바일에서 이미지 폭이 약 300px라 720 기준으로 짜고 1.5배로 그림
const W = 720;
const px = (n: number) => Math.round(n * 1.5);

const MODE = { points: "포인트제", checkpoint: "체크포인트", double: "더블 체크포인트" } as const;

const cut = (b: Board) => (b.mode === "points" && b.advance > 0 && b.advance < b.standings.length ? b.advance : 0);

function meta(b: Board): string {
  const parts: string[] = [MODE[b.mode]];
  // 결과 전 이미지는 안내 메시지로 대회가 끝날 때까지 남아 진행 상황 대신 방식만 씀
  if (!b.played && !b.ended) parts.push(b.mode === "points" ? `${b.plannedRounds}라운드` : `최대 ${b.plannedRounds}라운드`);
  else if (b.ended) parts.push(`${b.played}라운드`);
  else if (cut(b)) parts.push(`상위 ${b.advance}팀 진출`);
  return parts.join(" | ");
}

function roundLabel(b: Board): string {
  if (b.ended) return "최종";
  if (!b.played) return "";
  return b.mode === "points" ? `${b.played}/${b.plannedRounds}라운드` : `${b.played}라운드`;
}

type Tag = { text: string; color: string; fill?: boolean };

function tags(b: Board, s: BoardRow): Tag[] {
  const out: Tag[] = [];
  if (b.ended && s.rank === 1 && b.mode !== "points") out.push({ text: "우승", color: C.gold, fill: true });
  else if (s.fixed) out.push({ text: `${s.fixed}위 확정`, color: C.gold });
  else if (b.mode !== "points" && s.checkpoint && !b.ended) out.push({ text: "체크포인트", color: C.gold });
  if (s.penalty) out.push({ text: `감점 ${num(s.penalty)}`, color: C.down });
  return out;
}

const TagBox = ({ t, size }: { t: Tag; size: number }) => (
  <span
    style={{
      display: "flex",
      flexShrink: 0,
      fontSize: size,
      fontWeight: 700,
      lineHeight: 1.25,
      color: t.fill ? "#111" : t.color,
      background: t.fill ? t.color : "transparent",
      border: `${px(1.5)}px solid ${t.color}`,
      borderRadius: px(5),
      padding: `0 ${Math.round(size * 0.35)}px`,
      whiteSpace: "nowrap",
    }}
  >
    {t.text}
  </span>
);

const ROW = 60;
const COL = { rank: 54, kill: 82, total: 116, delta: 52 };

// 방송 순위표처럼 소수 첫째 자리까지 쓰고 소수 부분은 작게. satori는 tabular-nums를 무시해 숫자마다 폭을 고정
const BASE = 0.15;
function digits(text: string, size: number, key: string, lift = 0) {
  return [...text].map((c, i) => (
    <span key={`${key}${i}`} style={{ display: "flex", justifyContent: "center", width: c === "." ? size * 0.3 : c === "-" ? size * 0.4 : size * 0.6, fontSize: size, lineHeight: 1, marginBottom: lift }}>{c}</span>
  ));
}

function score(v: number, size: number) {
  const [whole, frac] = (Math.round(v * 10) / 10).toFixed(1).split(".");
  const small = Math.round(size * 0.72);
  // lineHeight 1에서 기준선이 글자 크기에 비례해 아래에 있어 작은 글자를 그만큼 올림
  return [...digits(`${whole}.`, size, "w"), ...digits(frac, small, "f", (size - small) * BASE)];
}

export async function roundImage(b: Board) {
  const [medium, bold, extra] = await fonts;
  const shown = await covered;
  const rows = b.standings;
  // 팀이 10을 넘으면 줄과 글자를 같은 비율로 줄임
  const k = rows.length > 10 ? 0.75 : 1;
  const z = (n: number) => px(n * k);
  const pad = 32;
  const head = 100;
  const colHead = 36 * k;
  const advance = cut(b);
  const height = px(pad * 2 + head + (rows.length ? colHead + rows.length * ROW * k + (advance ? 6 : 0) : 0));
  const showDelta = b.played > 1;
  const title = keepGlyphs(b.name, shown) || b.code;
  const group = b.groupCount > 1 ? `${b.group}조` : "";
  const border = `${px(1)}px solid ${C.line}`;
  const right = { display: "flex", justifyContent: "flex-end" } as const;

  const body: React.ReactNode[] = [
    <div key="col" style={{ display: "flex", alignItems: "flex-end", height: px(colHead), paddingBottom: px(6), fontSize: z(21), fontWeight: 700, color: C.text3, borderBottom: border }}>
      <span style={{ display: "flex", flex: 1 }} />
      <span style={{ ...right, width: z(COL.kill) }}>킬 점수</span>
      <span style={{ ...right, width: z(COL.total) }}>총점</span>
      <span style={{ ...right, width: z(COL.delta) }}>{showDelta ? "변동" : ""}</span>
    </div>,
  ];
  rows.forEach((s, i) => {
    const d = showDelta ? s.delta : 0;
    body.push(
      <div key={i} style={{ display: "flex", alignItems: "center", height: px(ROW * k), borderBottom: border }}>
        <div style={{ display: "flex", width: z(COL.rank) }}>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: z(38),
              height: z(38),
              borderRadius: px(7),
              fontSize: z(21),
              fontWeight: 800,
              background: s.rank === 1 ? C.gold : C.panel,
              color: s.rank === 1 ? "#111" : C.text,
            }}
          >
            {s.rank}
          </span>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: z(8), overflow: "hidden" }}>
          <span style={{ fontSize: z(29), fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{keepGlyphs(s.name, shown) || "이름 없는 팀"}</span>
          {tags(b, s).map((t) => (
            <TagBox key={t.text} t={t} size={z(20)} />
          ))}
        </div>
        <span style={{ ...right, alignItems: "flex-end", width: z(COL.kill), fontWeight: 700, color: C.text }}>{score(s.killScore, z(28))}</span>
        <span style={{ ...right, alignItems: "flex-end", width: z(COL.total), fontWeight: 800 }}>{score(s.total, z(36))}</span>
        <span style={{ ...right, width: z(COL.delta), fontSize: z(22), fontWeight: 700, color: d > 0 ? C.up : C.down }}>{d > 0 ? `▲${d}` : d < 0 ? `▼${-d}` : ""}</span>
      </div>,
    );
    if (advance && i === advance - 1) body.push(<div key="adv" style={{ display: "flex", height: px(6), background: C.accent, borderRadius: px(3) }} />);
  });

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.bg, color: C.text, fontFamily: "Pretendard", padding: px(pad) }}>
        <div style={{ display: "flex", flexDirection: "column", height: px(head) }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: px(12) }}>
            <span style={{ fontSize: px(36), fontWeight: 800, maxWidth: px(W - pad * 2 - 260), overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{title}</span>
            {group && <span style={{ fontSize: px(36), fontWeight: 800, color: C.accent }}>{group}</span>}
            {roundLabel(b) && <span style={{ marginLeft: "auto", fontSize: px(34), fontWeight: 800, color: C.gold }}>{roundLabel(b)}</span>}
          </div>
          <span style={{ fontSize: px(24), fontWeight: 500, color: C.text2, marginTop: px(8) }}>{meta(b)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.length ? body : null}
        </div>
      </div>
    ),
    {
      width: px(W),
      height,
      fonts: [
        { name: "Pretendard", data: medium, weight: 500 as const },
        { name: "Pretendard", data: bold, weight: 700 as const },
        { name: "Pretendard", data: extra, weight: 800 as const },
      ],
    },
  );
}
