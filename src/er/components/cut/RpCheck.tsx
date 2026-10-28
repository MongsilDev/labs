"use client";

import { useState } from "react";
import { between, chance, chanceLabel, type CutData, daysLeft, graceKey, int, quitRp, TIERS, tens } from "@/er/lib/cut";

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

export default function RpCheck({ data, initial }: { data: CutData; initial?: number }) {
  const [text, setText] = useState(initial != null ? String(initial) : "");
  const rp = Number(text);
  const valid = text !== "" && Number.isFinite(rp) && rp >= 0 && rp <= 20000;
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
        placeholder="예: 9050"
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
      />
      {valid && (
        <div className="mt-4 grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
          {TIERS.map(({ key, name, color }) => {
            const tier = data.tiers[key];
            if (tier.cut == null) return null;
            const gap = tier.cut - rp;
            const near = between(data.rps, rp, tier.cut);
            const end = tier.forecast?.[tier.forecast.length - 1];
            return (
              <section key={key} className="rounded-md border border-line px-4 py-3" aria-label={`${name} 진단`}>
                <h3 className="mb-1 flex items-center gap-1.5 text-[15px] font-extrabold">
                  <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                  {name}
                </h3>
                <dl>
                  <Row
                    label="휴면 반영 컷"
                    value={gap > 0 ? `${int(gap)} RP 부족` : `${int(-gap)} RP 여유`}
                    note={near != null ? `순위표 기준 내 RP와 컷 사이 ${int(near)}명` : "순위표 밖이라 사이 인원을 알 수 없음"}
                  />
                  {end && (
                    <Row
                      label="종료 예상 컷"
                      value={end[1] > rp ? `${int(end[1] - rp)} RP 부족` : `${int(rp - end[1])} RP 여유`}
                      note={end[1] > rp && left ? `${tens(end[1])}까지 하루 ${int(Math.ceil((end[1] - rp) / left))} RP씩` : undefined}
                    />
                  )}
                  {end && (
                    <Row
                      label="가능성"
                      value={chanceLabel(chance(rp, end[1], end[4], end[3]))}
                      note="지금 RP로 끝나면"
                    />
                  )}
                  {end && quit != null && (
                    <Row
                      label="오늘부터 쉬면"
                      value={`종료 때 ${int(quit)} RP`}
                      note={`종료 예상 컷${quit >= end[1] ? "보다 높음" : "보다 낮음"}, 유예 ${grace}일 가정`}
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
