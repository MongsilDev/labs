"use client";

import { BAN_LABEL, LIMITS, TIEBREAK_LABEL, type Ban, type Mode, type Rules, type Tiebreak } from "@/er/lib/rules";

export default function RulesFields({ rules, mode, rounds, onChange }: { rules: Rules; mode: Mode; rounds: number; onChange: (r: Rules) => void }) {
  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => onChange({ ...rules, [k]: v });
  const cp = rules.checkpoint;
  return (
    <div className="mt-3.5 grid gap-4 border-t border-line-soft pt-3.5 [form>&]:mt-0">
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="lbl" htmlFor="rf-adv">진출 표시</label>
          <select id="rf-adv" className="field" value={rules.advance} onChange={(e) => set("advance", Number(e.target.value))}>
            <option value={0}>표시 안 함</option>
            {Array.from({ length: LIMITS.teamsPerGroup - 1 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                상위 {i + 1}팀
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="rf-tie">동점일 때</label>
          <select id="rf-tie" className="field" value={rules.tiebreak} onChange={(e) => set("tiebreak", e.target.value as Tiebreak)}>
            {(Object.keys(TIEBREAK_LABEL) as Tiebreak[]).map((t) => (
              <option key={t} value={t}>
                {TIEBREAK_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="lbl" htmlFor="rf-ban">3-PICK-BAN</label>
        <select id="rf-ban" className="field" value={rules.bans} onChange={(e) => set("bans", e.target.value as Ban)}>
          {(Object.keys(BAN_LABEL) as Ban[]).map((b) => (
            <option key={b} value={b}>
              {BAN_LABEL[b]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="grid gap-2">
        <legend className="lbl">적용할 규칙</legend>
        <label className="flex cursor-pointer items-center gap-2 text-[14px] [&>input]:size-4 [&>input]:accent-accent">
          <input type="checkbox" checked={rules.deathPenalty} onChange={(e) => set("deathPenalty", e.target.checked)} />
          처치자 불명 사망 1회 1점 감점
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[14px] [&>input]:size-4 [&>input]:accent-accent">
          <input type="checkbox" checked={rules.subWeather} onChange={(e) => set("subWeather", e.target.checked)} />
          서브 날씨 후보 표시
        </label>
      </fieldset>

      {rules.preset === "custom" && (
        <fieldset>
          <legend className="lbl">순위별 점수</legend>
          <div className="grid grid-cols-4 gap-2 [&>label]:grid [&>label]:gap-1 [&>label]:text-[12px] [&>label]:text-fg-3">
            {rules.placementPoints.map((p, i) => (
              <label key={i}>
                <span>{i + 1}위</span>
                <input
                  className="field sm"
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  value={p}
                  onChange={(e) => {
                    const next = [...rules.placementPoints];
                    next[i] = Number(e.target.value) || 0;
                    set("placementPoints", next);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5" style={{ marginTop: 10 }}>
            <div>
              <label className="lbl" htmlFor="rf-km">킬 점수 1당 점수</label>
              <input id="rf-km" className="field" type="number" inputMode="decimal" step={0.5} min={0} value={rules.killMultiplier} onChange={(e) => set("killMultiplier", Number(e.target.value) || 0)} />
            </div>
          </div>
        </fieldset>
      )}

      {mode !== "points" && (
        <fieldset>
          <legend className="lbl">체크포인트</legend>
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="lbl" htmlFor="rf-cpt">받는 조건</label>
              <select id="rf-cpt" className="field" value={cp.type} onChange={(e) => set("checkpoint", { ...cp, type: e.target.value as Rules["checkpoint"]["type"] })}>
                <option value="sequential">라운드별 상위 팀</option>
                <option value="points">기준 점수 도달</option>
              </select>
            </div>
            {cp.type === "points" ? (
              <div>
                <label className="lbl" htmlFor="rf-cpp">기준 점수</label>
                <input id="rf-cpp" className="field" type="number" inputMode="numeric" min={1} value={cp.points} onChange={(e) => set("checkpoint", { ...cp, points: Number(e.target.value) || 1 })} />
              </div>
            ) : (
              <div>
                <label className="lbl" htmlFor="rf-cpk">순위가 밀리면</label>
                <select id="rf-cpk" className="field" value={cp.keep ? "keep" : "lose"} onChange={(e) => set("checkpoint", { ...cp, keep: e.target.value === "keep" })}>
                  <option value="lose">체크포인트 해제</option>
                  <option value="keep">계속 유지</option>
                </select>
              </div>
            )}
          </div>
          {cp.type === "sequential" && (
            <>
              <p className="mt-2.5 text-[12px] text-fg-3">라운드를 시작할 때 체크포인트를 받는 팀 수</p>
              <div className="mt-1.5 grid grid-cols-4 gap-2 [&>label]:grid [&>label]:gap-1 [&>label]:text-[12px] [&>label]:text-fg-3">
                {Array.from({ length: rounds }, (_, i) => (
                  <label key={i}>
                    <span>{i + 1}R 시작</span>
                    <input
                      className="field sm"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={LIMITS.teamsPerGroup}
                      aria-label={`${i + 1}라운드 시작 때 체크포인트 팀 수`}
                      value={cp.sequence[i] ?? cp.sequence[cp.sequence.length - 1] ?? 0}
                      onChange={(e) => {
                        const seq = Array.from({ length: rounds }, (_, k) => cp.sequence[k] ?? cp.sequence[cp.sequence.length - 1] ?? 0);
                        seq[i] = Math.max(0, Math.min(LIMITS.teamsPerGroup, Number(e.target.value) || 0));
                        set("checkpoint", { ...cp, sequence: seq });
                      }}
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          <label className="mt-2.5 flex cursor-pointer items-center gap-2 text-[14px] [&>input]:size-4 [&>input]:accent-accent">
            <input type="checkbox" checked={cp.penaltyKeeps} onChange={(e) => set("checkpoint", { ...cp, penaltyKeeps: e.target.checked })} />
            라운드 사이 규정 위반 감점으로는 해제하지 않음
          </label>
        </fieldset>
      )}
    </div>
  );
}
