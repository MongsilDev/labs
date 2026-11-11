import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LABS_ACCENT } from "@/components/SiteMark";
import { glyphs, keepGlyphs } from "@/glyphs";
import { type CutData, daysLeft, int, tens } from "@/er/lib/cut";
import { groupResult } from "@/er/lib/engine";
import { fmt1 } from "@/er/lib/format";
import type { TournamentView } from "@/er/lib/view";

export const OG_SIZE = { width: 1200, height: 630 };

const font = (w: string) => readFile(join(process.cwd(), `assets/fonts/Pretendard-${w}.otf`));
const fonts = Promise.all([font("Medium"), font("Bold"), font("ExtraBold")]);
const covered = fonts.then(([medium]) => glyphs(medium));

const C = { bg: "#121212", panel: "#1a1a1a", line: "#2e2e2e", text: "#ededed", text2: "#a6a6a6", text3: "#8a8a8a", accent: LABS_ACCENT, gold: "#ffd621" };


export function summary(view: TournamentView, idx: number): string {
  const res = groupResult(view, idx);
  const where = view.groupCount > 1 ? `${view.groups[idx].label}조 ` : "";
  if (res.played === 0) return `${where}경기 전`;
  const top = res.standings[0];
  const state = res.ended ? "경기 종료" : `${res.played}라운드 진행`;
  return `${where}${state}, 1위 ${top.name} ${fmt1(top.total)}점`;
}

const Mark = () => (
  <svg width="44" height="44" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="15" fill="#000" />
    <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="#fff" strokeOpacity=".14" />
    <path d="M15 21l11 11-11 11" fill="none" stroke="#f5f5f7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M33 44h17" stroke={C.accent} strokeWidth="7" strokeLinecap="round" />
  </svg>
);

async function options() {
  const [medium, bold, extra] = await fonts;
  return {
    ...OG_SIZE,
    fonts: [
      { name: "Pretendard", data: medium, weight: 500 as const },
      { name: "Pretendard", data: bold, weight: 700 as const },
      { name: "Pretendard", data: extra, weight: 800 as const },
    ],
  };
}

export async function siteImage({ sub = "이터널 리턴 도구 모음", url = "labs.mongsil.dev/er", accent = C.accent } = {}) {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "100%", height: "100%", background: C.bg, color: C.text, fontFamily: "Pretendard", padding: "0 96px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="120" height="120" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="15" fill="#000" />
            <rect x=".5" y=".5" width="63" height="63" rx="14.5" fill="none" stroke="#fff" strokeOpacity=".14" />
            <path d="M15 21l11 11-11 11" fill="none" stroke="#f5f5f7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M33 44h17" stroke={accent} strokeWidth="7" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 96, fontWeight: 800 }}>Labs</span>
        </div>
        <span style={{ fontSize: 36, fontWeight: 500, color: C.text2, marginTop: 36 }}>{sub}</span>
        <span style={{ fontSize: 28, fontWeight: 500, color: C.text3, marginTop: 14 }}>{url}</span>
      </div>
    ),
    await options(),
  );
}

export async function boardImage(view: TournamentView | null, idx: number) {
  const res = view ? groupResult(view, idx) : null;
  const rows = res ? res.standings.slice(0, 8) : [];
  const meta = view ? summary(view, idx).split(", 1위")[0] : "";
  const shown = await covered;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.bg, color: C.text, fontFamily: "Pretendard", padding: "48px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Mark />
          <span style={{ fontSize: 26, fontWeight: 700, color: C.text2 }}>Labs</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 26, gap: 24 }}>
          <span style={{ fontSize: 52, fontWeight: 800, maxWidth: 820, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {view ? keepGlyphs(view.name, shown) || view.code : "없거나 지워진 대회"}
          </span>
          <span style={{ fontSize: 26, fontWeight: 500, color: C.text3, whiteSpace: "nowrap" }}>{meta}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 24, borderTop: `1px solid ${C.line}` }}>
          {rows.length === 0 && view && <span style={{ fontSize: 28, color: C.text3, marginTop: 40 }}>아직 등록된 경기 결과가 없습니다.</span>}
          {rows.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", height: rows.length > 6 ? 42 : 52, borderBottom: `1px solid ${C.line}`, gap: 20 }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 40,
                  height: 32,
                  borderRadius: 6,
                  fontSize: 20,
                  fontWeight: 800,
                  background: s.rank === 1 ? C.gold : C.panel,
                  color: s.rank === 1 ? "#111" : C.text,
                }}
              >
                {s.rank}
              </span>
              <span style={{ flex: 1, fontSize: 26, fontWeight: 700, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{keepGlyphs(s.name, shown) || "이름 없는 팀"}</span>
              {s.checkpoint && view?.mode !== "points" && (
                <span style={{ fontSize: 17, fontWeight: 700, color: C.gold, border: `1.5px solid ${C.gold}`, borderRadius: 5, padding: "2px 8px" }}>체크포인트</span>
              )}
              <span style={{ fontSize: 30, fontWeight: 800, width: 130, textAlign: "right", justifyContent: "flex-end", display: "flex" }}>{fmt1(s.total)}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    await options(),
  );
}

const TIER_OG = [
  { key: "eternity", name: "이터니티", color: "#e84c7d" },
  { key: "demigod", name: "데미갓", color: "#be8a35" },
] as const;

export async function cutImage(data: CutData) {
  const left = data.season.end ? daysLeft(data.season.end * 1000, data.updatedAt * 1000) : null;
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.bg, color: C.text, fontFamily: "Pretendard", padding: "48px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Mark />
          <span style={{ fontSize: 26, fontWeight: 700, color: C.text2 }}>Labs</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 26 }}>
          <span style={{ fontSize: 56, fontWeight: 800 }}>이터컷 예측</span>
          <span style={{ fontSize: 26, fontWeight: 500, color: C.text3 }}>
            {data.season.name} | 아시아1{left != null ? ` | 종료 D-${left}` : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: 24, marginTop: 34 }}>
          {TIER_OG.map(({ key, name, color }) => {
            const tier = data.tiers[key];
            const end = tier.forecast?.[tier.forecast.length - 1];
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "26px 30px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 26, fontWeight: 700, color: C.text2 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: color }} />
                  {name} {int(tier.place)}위
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
                  {tier.estimated && <span style={{ fontSize: 32, fontWeight: 700, color: C.text3 }}>약</span>}
                  <span style={{ fontSize: 76, fontWeight: 800, lineHeight: 1 }}>{tier.cut != null ? int(tier.cut) : "-"}</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: C.text3 }}>RP</span>
                </div>
                {end && (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 22, paddingTop: 16, borderTop: `1px solid ${C.line}`, fontSize: 24, color: C.text3 }}>
                    종료 예상
                    <span style={{ fontSize: 34, fontWeight: 800, color }}>{tens(end[1])}</span>
                    <span style={{ fontWeight: 700, color: C.text2 }}>
                      {tens(end[2])}~{tens(end[3])}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 24, fontWeight: 500, color: C.text3, marginTop: "auto" }}>labs.mongsil.dev/er/cut</span>
      </div>
    ),
    await options(),
  );
}
