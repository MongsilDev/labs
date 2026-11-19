"use client";

import { useState } from "react";
import { between, boardRank, chance, chanceLabel, type CutData, daysLeft, graceKey, int, quitRp, round10, TIERS } from "@/er/lib/cut";

function Row({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 border-t border-line-soft py-2 first:border-t-0">
      <dt className="text-[13px] text-fg-3">{label}</dt>
      <dd>
        <span className="font-bold tabular-nums">{value}</span>
        {note && <span className="block text-[12px] text-fg-3">{note}</span>}
      </dd>
    </div>
  );
}

/** floor는 시즌 초 300위가 8,300 미만이라 컷이 하한에 묶인 동안. 사이 인원 대신 지금 순위를 보여 줌 */
export default function RpCheck({ data, initial, floor = false }: { data: CutData; initial?: number; floor?: boolean }) {
  const [text, setText] = useState(initial != null ? String(initial) : "");
  // 비어 있는 동안 이터니티 300위 RP로 계산한 결과를 흐리게 보여 무엇이 나오는지 알 수 있게 함
  const example = data.rps[data.tiers.eternity.place - 1] ?? data.tiers.eternity.cut ?? 0;
  const typed = text !== "";
  const rp = typed ? Number(text) : example;
  const valid = Number.isFinite(rp) && rp >= 0 && rp <= 20000 && (typed || rp > 0);
  const place = boardRank(data.rps, rp);
  const left = data.season.end ? daysLeft(data.season.end * 1000, data.updatedAt * 1000) : null;
  const key = valid ? graceKey(data, rp) : "default";
  const grace = data.updatedAt < data.rule.graceFrom ? data.rule.grace.default : data.rule.grace[key];
  const quit = valid && data.quitTicks ? quitRp(rp, data.quitTicks[key], data.rule.step, data.rule.floor) : null;

  return (
    <div>
      <label className="lbl" htmlFor="my-rp">
        내 RP
      </label>
      <input
        id="my-rp"
        className="field w-full max-w-[220px] tabular-nums"
        inputMode="numeric"
        autoComplete="off"
        placeholder={`예: ${example}`}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
      />
      {valid && (
        <div className={`mt-4 grid grid-cols-2 gap-3 max-[760px]:grid-cols-1 ${typed ? "" : "opacity-45"}`} aria-hidden={!typed}>
          {/* 시즌 초에는 두 컷이 모두 8,300이라 결과도 같아서 한 칸만 */}
          {(floor ? TIERS.slice(0, 1) : TIERS).map(({ key, name, color }) => {
            const tier = data.tiers[key];
            if (tier.cut == null) return null;
            const gap = tier.cut - rp;
            const near = between(data.rps, rp, tier.cut);
            const end = tier.forecast?.[tier.forecast.length - 1];
            // 화면의 종료 예상이 10 단위라 부족분과 가능성도 같은 값으로 계산
            const goal = end && round10(end[1]);
            return (
              <section key={key} className="rounded-md border border-line px-4 py-3" aria-label={`${name} 진단`}>
                {!floor && (
                  <h3 className="mb-1 flex items-center gap-1.5 text-[15px] font-bold">
                    <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                    {name}
                  </h3>
                )}
                <dl>
                  <Row
                    label={floor ? `${int(tier.cut)}까지` : "휴면 반영 컷"}
                    value={gap > 0 ? `${int(gap)} RP 부족` : `${int(-gap)} RP 여유`}
                    note={
                      floor
                        ? place
                          ? `지금 아시아1 ${place.tied ? "공동 " : ""}${int(place.rank)}위`
                          : "지금 아시아1 순위표 밖"
                        : near != null
                          ? `순위표 기준 내 RP와 컷 사이 ${int(near)}명`
                          : "순위표 밖이라 사이 인원을 알 수 없음"
                    }
                  />
                  {end && goal != null && (
                    <Row
                      label="종료 예상 컷"
                      value={goal > rp ? `${int(goal - rp)} RP 부족` : `${int(rp - goal)} RP 여유`}
                      note={goal > rp && left ? `${int(goal)}까지 하루 ${int(Math.ceil((goal - rp) / left))} RP씩` : undefined}
                    />
                  )}
                  {end && goal != null && (
                    <Row
                      label="가능성"
                      value={chanceLabel(chance(rp, goal, end[4], end[3]))}
                      note="지금 RP로 끝나면"
                    />
                  )}
                  {goal != null && quit != null && (
                    <Row
                      label="오늘부터 쉬면"
                      value={`종료 때 ${int(quit)} RP`}
                      note={`종료 예상 컷${quit >= goal ? "보다 높음" : "보다 낮음"}, 유예 ${grace}일 가정`}
                    />
                  )}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
