"use client";

import { useState } from "react";
import type { GroupResult } from "@/er/lib/engine";
import { fmt, num } from "@/er/lib/format";
import type { Rules } from "@/er/lib/rules";
import Char from "./Char";

type Tab = "rounds" | "picks" | "players";

const PICK = "flex items-center gap-2 py-1 text-[13px]";

export default function Details({ result, rules }: { result: GroupResult; rules: Rules }) {
  const [tab, setTab] = useState<Tab>("rounds");
  const { standings, played, picks, players } = result;
  if (played === 0) return null;
  const anyPenalty = standings.some((s) => s.penalty > 0);
  const tabs: [Tab, string][] = [
    ["rounds", "라운드별 점수"],
    ["picks", "실험체 선택"],
    ["players", "선수 기록"],
  ];
  return (
    <div className="mt-5 max-[1100px]:order-2 max-[1100px]:mt-1">
      <div className="tabs mb-2.5" role="tablist" aria-label="상세 기록">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className={`panel overflow-x-auto ${tab === "players" ? "max-w-[720px]" : ""}`}>
        {tab === "rounds" && (
          <table className="rt">
            <thead>
              <tr>
                <th scope="col" rowSpan={2} className="l sticky">팀</th>
                {Array.from({ length: played }, (_, i) => (
                  <th key={i} scope="colgroup" colSpan={3} className="rs">
                    {i + 1}라운드
                  </th>
                ))}
                {anyPenalty && <th scope="col" rowSpan={2} className="rs">감점</th>}
                <th scope="col" rowSpan={2} className="rs sticky-r">총점</th>
              </tr>
              <tr>
                {Array.from({ length: played }, (_, i) => [
                  <th key={`p${i}`} scope="col" className="rs">순위</th>,
                  <th key={`k${i}`} scope="col">킬 점수</th>,
                  <th key={`s${i}`} scope="col">점수</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => (
                <tr key={s.key}>
                  <th scope="row" className="l sticky">{s.name}</th>
                  {s.rounds.slice(0, played).map((r, i) => [
                    <td key={`p${i}`} className={r?.placement === 1 ? "rs win" : "rs"}>{r?.placement ?? "-"}</td>,
                    <td key={`k${i}`}>{r ? num(r.killScore) : "-"}</td>,
                    <td key={`s${i}`}>{r ? num(r.score) : "-"}</td>,
                  ])}
                  {anyPenalty && <td className="rs minus">{s.penalty > 0 ? `-${fmt(s.penalty)}` : ""}</td>}
                  <td className="rs strong sticky-r">{num(s.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "picks" &&
          (picks.length === 0 ? (
            <p className="p-[18px] text-fg-3">CSV로 올린 라운드가 없어 실험체 기록이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
              {picks.map((p) => (
                <section key={p.roundNo} className="border-r border-b border-line-soft px-4 py-3.5" aria-label={`${p.roundNo}라운드 실험체`}>
                  <h3 className="mb-2 text-[14px] font-bold">{p.roundNo}라운드</h3>
                  <ul className="list-none">
                    {p.counts.filter((c) => c.count >= 2 || c.banRounds > 0).length === 0 && <li className={`${PICK} text-fg-3`}>2명 이상 고른 실험체 없음</li>}
                    {p.counts
                      .filter((c) => c.count >= 2 || c.banRounds > 0)
                      .map((c) => (
                        <li key={c.character} className={PICK}>
                          <Char name={c.character} />
                          <span className="text-fg-3">{c.count}명</span>
                          {c.banRounds > 0 && rules.bans && (
                            <span className="ml-auto text-[12px] font-bold text-minus">
                              {c.banRounds === 1 ? `${p.roundNo + 1}라운드 금지` : `${p.roundNo + 1}~${p.roundNo + c.banRounds}라운드 금지`}
                            </span>
                          )}
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          ))}
        {tab === "players" &&
          (players.length === 0 ? (
            <p className="p-[18px] text-fg-3">CSV로 올린 라운드가 없어 선수 기록이 없습니다.</p>
          ) : (
            <table className="pstats" aria-label="라운드당 킬 상위 선수">
              <thead>
                <tr>
                  <th scope="col">순위</th>
                  <th scope="col">선수</th>
                  <th scope="col" className="r">라운드</th>
                  <th scope="col" className="r">킬</th>
                  <th scope="col" className="r">라운드당 킬</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.nickname + p.team}>
                    <td className="font-extrabold text-fg-3">{p.rank}</td>
                    <td className="nm">
                      <b>{p.nickname}</b> <span className="text-fg-3">{p.team}</span>
                    </td>
                    <td className="r tabular-nums text-fg-3">{p.rounds}</td>
                    <td className="r tabular-nums">{p.kills}</td>
                    <td className="r tabular-nums strong">{p.value.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>
    </div>
  );
}
