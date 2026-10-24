"use client";

import { useMemo, useState } from "react";
import { normalize, type GroupResult } from "@/er/lib/engine";
import { ago, byText, fmt } from "@/er/lib/format";
import { RULE_PENALTIES, type Mode, type Rules } from "@/er/lib/rules";
import type { GroupView, LogRow, Op } from "@/er/lib/view";

type Run = (op: Op) => Promise<unknown>;

const CUSTOM = "직접 입력";

export function Penalties({ group, result, rules, run }: { group: GroupView; result: GroupResult; rules: Rules; run: Run }) {
  const teams = result.standings.map((s) => ({ key: s.key, name: s.name, bases: s.bases.length ? s.bases : [{ round: 0, base: s.base }] }));
  const [team, setTeam] = useState("");
  const [reason, setReason] = useState(rules.deathPenalty ? "처치자 불명 사망" : RULE_PENALTIES[0].reason);
  const [picked, setRound] = useState<string | null>(null);
  const round = picked ?? String(Math.max(1, result.played));
  const [amount, setAmount] = useState("1");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const death = reason === "처치자 불명 사망";
  const preset = RULE_PENALTIES.find((p) => p.reason === reason);
  const selectedTeam = teams.some((t) => t.key === team) ? team : (teams[0]?.key ?? "");
  // 감점은 그 라운드 기록의 기준 이름으로 저장해 다른 라운드 기록이 지워져도 감점이 그 팀에 남게 함
  const baseFor = (key: string, roundNo: number) => {
    const bases = teams.find((t) => t.key === key)?.bases ?? [];
    return (bases.find((b) => b.round === roundNo) ?? bases[bases.length - 1])?.base ?? "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) return;
    setBusy(true);
    try {
      await run({
        op: "add_penalty",
        group: group.idx,
        team: baseFor(selectedTeam, Number(round)),
        round: Number(round),
        kind: death ? "death" : "rule",
        count: death ? Number(amount) || 1 : undefined,
        points: death ? undefined : Number(amount) || preset?.points || 0,
        reason: death ? undefined : reason === CUSTOM ? custom : reason,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel min-w-0 p-4" aria-labelledby={`pen-${group.idx}`}>
      <h2 className="text-[15px] font-bold" id={`pen-${group.idx}`}>감점</h2>
      {teams.length === 0 ? (
        <p className="text-[13px] text-fg-3">경기 결과를 등록하면 감점을 추가할 수 있습니다.</p>
      ) : (
        <form className="mt-3 grid grid-cols-2 gap-2.5 *:min-w-0" onSubmit={submit} noValidate>
          <div className="col-span-full">
            <label className="lbl" htmlFor={`pt-${group.idx}`}>팀</label>
            <select id={`pt-${group.idx}`} className="field sm" value={selectedTeam} onChange={(e) => setTeam(e.target.value)}>
              {teams.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-full">
            <label className="lbl" htmlFor={`pr-${group.idx}`}>사유</label>
            <select
              id={`pr-${group.idx}`}
              className="field sm"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                const p = RULE_PENALTIES.find((x) => x.reason === e.target.value);
                setAmount(e.target.value === "처치자 불명 사망" ? "1" : p ? String(p.points) : "1");
              }}
            >
              {rules.deathPenalty && <option>처치자 불명 사망</option>}
              {RULE_PENALTIES.map((p) => (
                <option key={p.reason} value={p.reason}>
                  {p.reason}
                </option>
              ))}
              <option>{CUSTOM}</option>
            </select>
          </div>
          {reason === CUSTOM && (
            <div className="col-span-full">
              <label className="lbl" htmlFor={`pc-${group.idx}`}>사유 내용</label>
              <input id={`pc-${group.idx}`} className="field sm" maxLength={40} value={custom} onChange={(e) => setCustom(e.target.value)} autoComplete="off" />
            </div>
          )}
          <div>
            <label className="lbl" htmlFor={`prr-${group.idx}`}>라운드</label>
            <select id={`prr-${group.idx}`} className="field sm" value={round} onChange={(e) => setRound(e.target.value)}>
              {Array.from({ length: Math.max(1, result.played) }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}라운드
                </option>
              ))}
              <option value="0">라운드 무관</option>
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor={`pa-${group.idx}`}>{death ? "횟수" : "점수"}</label>
            <input
              id={`pa-${group.idx}`}
              className="field sm"
              type="number"
              inputMode="decimal"
              min={death ? 1 : 0.5}
              step={death ? 1 : 0.5}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <button className="btn primary col-span-full" disabled={busy}>
            {death ? `${Number(amount) || 1}점 감점` : `${fmt(Number(amount) || 0)}점 감점`}
          </button>
        </form>
      )}
      {group.penalties.length > 0 && (
        <ul className="plist">
          {group.penalties.map((p) => (
            <li key={p.id}>
              <span className="chip">{p.roundNo ? `${p.roundNo}R` : "전체"}</span>
              <span className="min-w-0 flex-1 truncate">
                {result.displayOf.get(normalize(p.team)) ?? p.team} {p.kind === "death" ? `처치자 불명 사망 ${p.count}회` : p.reason}
              </span>
              {result.orphanPenalties.includes(p.id) && (
                <span className="chip dashed" title="이 감점을 받은 팀이 경기 기록에 없습니다">팀 없음</span>
              )}
              <b>-{fmt(p.points)}</b>
              <button type="button" className="link" aria-label={`${result.displayOf.get(normalize(p.team)) ?? p.team} 감점 삭제`} onClick={() => run({ op: "delete_penalty", id: p.id })}>
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Teams({ group, result, mode, rules, run }: { group: GroupView; result: GroupResult; mode: Mode; rules: Rules; run: Run }) {
  const names = useMemo(() => result.standings.map((s) => s.name), [result]);
  const raw = useMemo(() => [...new Set(result.standings.map((s) => s.name))].sort(byText), [result]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const source = raw.includes(from) ? from : (raw[0] ?? "");
  const next = result.next;

  return (
    <section className="panel min-w-0 p-4" aria-labelledby={`teams-${group.idx}`}>
      <h2 className="text-[15px] font-bold" id={`teams-${group.idx}`}>팀 정리</h2>
      {raw.length === 0 ? (
        <p className="text-[13px] text-fg-3">경기 결과를 등록하면 팀 이름을 정리할 수 있습니다.</p>
      ) : (
        <form
          className="mt-3 grid grid-cols-2 gap-2.5 *:min-w-0"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!source || !to.trim()) return;
            const st = result.standings.find((x) => x.name === source);
            await run({ op: "rename_team", group: group.idx, from: source, to, also: st?.bases.map((b) => b.base) ?? [] });
            setTo("");
          }}
        >
          <div className="col-span-full">
            <label className="lbl" htmlFor={`rf-${group.idx}`}>팀</label>
            <select id={`rf-${group.idx}`} className="field sm" value={source} onChange={(e) => setFrom(e.target.value)}>
              {raw.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="col-span-full">
            <label className="lbl" htmlFor={`rt-${group.idx}`}>바꿀 이름</label>
            <input
              id={`rt-${group.idx}`}
              className="field sm"
              list={`rl-${group.idx}`}
              maxLength={40}
              autoComplete="off"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="새 이름 또는 합칠 팀"
            />
            <datalist id={`rl-${group.idx}`}>
              {names.filter((n) => n !== source).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <button className="btn col-span-full">이름 바꾸기</button>
        </form>
      )}
      {Object.keys(group.aliases).length > 0 && (
        <ul className="plist">
          {[...Object.entries(group.aliases).reduce((acc, [from, to]) => acc.set(to, [...(acc.get(to) ?? []), from]), new Map<string, string[]>())].map(([to, froms]) => (
            <li key={to}>
              <span className="min-w-0 flex-1 truncate">
                {(() => {
                  const own = froms.filter((f) => normalize(f) !== normalize(to));
                  const records = own.filter((f) => result.displayOf.has(normalize(f)));
                  return (records.length ? records : own).join(", ");
                })()}{" "}
                대신 <b className="plain">{to}</b>
              </span>
              <button
                type="button"
                className="link"
                onClick={async () => {
                  for (const from of froms) await run({ op: "rename_team", group: group.idx, from, to: "" });
                }}
              >
                되돌리기
              </button>
            </li>
          ))}
        </ul>
      )}
      {mode !== "points" && next && result.standings.length > 0 && (
        <details
          className="mt-4"
          open={
            next.checkpoint.length > 0 ||
            Object.keys(group.overrides).some((k) => k.startsWith(`${next.roundNo}:`)) ||
            (rules.checkpoint.type === "sequential" && (rules.checkpoint.sequence[next.roundNo - 1] ?? 0) > 0)
          }
        >
          <summary className="lbl mb-0 list-item w-max cursor-pointer">{next.roundNo}라운드 체크포인트 조정</summary>
          <ul className="plist">
            {result.standings.map((s) => {
              const own = s.bases.length ? s.bases.map((b) => b.base) : [s.base];
              const hit = own.find((b) => group.overrides[`${next.roundNo}:${normalize(b)}`] !== undefined);
              const manual = hit ? group.overrides[`${next.roundNo}:${normalize(hit)}`] : undefined;
              const value = manual === undefined ? "auto" : manual ? "on" : "off";
              return (
                <li key={s.key}>
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {s.checkpoint && <span className="cp">체크포인트</span>}
                  <select
                    aria-label={`${s.name} 체크포인트`}
                    className="field sm mini"
                    value={value}
                    onChange={(e) =>
                      run({
                        op: "set_checkpoint",
                        group: group.idx,
                        round: next.roundNo,
                        team: hit ?? own[own.length - 1],
                        state: e.target.value === "auto" ? null : e.target.value === "on",
                      })
                    }
                  >
                    <option value="auto">자동</option>
                    <option value="on">부여</option>
                    <option value="off">해제</option>
                  </select>
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </section>
  );
}

export function Logs({ logs, now }: { logs: LogRow[]; now: number | null }) {
  if (logs.length === 0) return null;
  return (
    <section className="panel min-w-0 p-4" aria-labelledby="logs-h">
      <h2 className="text-[15px] font-bold" id="logs-h">변경 기록</h2>
      <ul className="mt-2 list-none">
        {logs.slice(0, 20).map((l) => (
          <li key={l.id} className="flex gap-2.5 border-b border-line-soft py-[7px] text-[13px] last:border-b-0">
            <span className="min-w-0 flex-1 truncate">{l.text}</span>
            <span className="text-[12px] whitespace-nowrap text-fg-3">
              {l.userName}
              {now !== null && `, ${ago(l.at, now)}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
