"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import { boardRank, chance, chanceLabel, type CutData, type CutTier, DAY, daysLeft, floorHead, GATE, graceKey, int, quitRp, round10, tens, TIERS } from "@/er/lib/cut";
import { RaceCount } from "./RaceLive";

const Ctx = createContext<[string, (v: string) => void]>(["", () => {}]);

/** 표에 넣은 내 RP를 컷 추이 그래프도 읽음 */
export function MyRp({ initial, children }: { initial?: number; children: ReactNode }) {
  const state = useState(initial != null ? String(initial) : "");
  return <Ctx value={state}>{children}</Ctx>;
}

/** 입력한 내 RP. 비었거나 20000을 넘으면 null */
export function useMyRp(): number | null {
  const [text] = useContext(Ctx);
  return text !== "" && Number(text) <= 20000 ? Number(text) : null;
}

/** 24시간 전에 가장 가까운 오전 9시 기록의 시각과, 지금 컷과의 차이. 그 기록이 12시간보다 가까우면 null */
function dayDelta(t: CutTier, at: number): [number, number] | null {
  if (t.cut == null) return null;
  const past = t.history.filter(([s, , a]) => a != null && at - s >= DAY / 2000);
  if (!past.length) return null;
  const [s, , a] = past.reduce((p, q) => (Math.abs(at - DAY / 1000 - q[0]) < Math.abs(at - DAY / 1000 - p[0]) ? q : p));
  return [s, t.cut - (a as number)];
}

const gapText = (v: number) => (v > 0 ? `${int(v)} RP 부족` : `${int(-v)} RP 여유`);

const kstDay = (s: number) => Math.floor((s * 1000 + 9 * 3_600_000) / DAY);
/** 기준 시각에서 본 그 기록의 날. 날짜 표기를 제목 줄과 따로 두지 않으려고 상대 표현으로 적음 */
function dayName(s: number, at: number): string {
  const n = kstDay(at) - kstDay(s);
  return n <= 0 ? "오늘" : n === 1 ? "어제" : `${n}일 전`;
}

function Row({ label, sub, children }: { label: ReactNode; sub?: ReactNode; children: ReactNode }) {
  return (
    <tr className="border-t border-rule">
      <th scope="row" className="py-3 pr-2 text-left align-baseline text-[13px] font-semibold whitespace-nowrap text-ink-2">
        {label}
        {sub && <span className="mt-0.5 block text-[12px] font-normal text-ink-3">{sub}</span>}
      </th>
      {children}
    </tr>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-[12px] font-normal whitespace-nowrap text-ink-3">{children}</span>;
}

const CELL = "py-3 pl-2 align-baseline";
const VAL = "text-[15px] font-bold whitespace-nowrap";

/** 지금 컷, 종료 예상, 내 RP와의 차이를 등급별 열로 보이는 표. live는 이터런이 열려 달성 인원이 1분마다 바뀌는 동안 */
export default function CutTable({ data, live }: { data: CutData; live: boolean }) {
  const [text, setText] = useContext(Ctx);
  const rp = useMyRp();
  const tiers = TIERS.map((m) => {
    const t = data.tiers[m.key];
    const end = t.forecast?.[t.forecast.length - 1];
    // 화면의 종료 예상이 10 단위라 부족분과 가능성도 같은 값으로 계산
    return { ...m, t, end, goal: end ? round10(end[1]) : null, floor: t.cut == null || t.cut <= GATE };
  });
  const seats = tiers.some((x) => x.floor);
  const ends = tiers.some((x) => x.end);
  // 시즌이 끝난 뒤에는 순위가 굳어 지금 컷이 곧 종료 컷
  const ended = data.season.end != null && data.updatedAt >= data.season.end;
  const reached = data.rps.filter((v) => v >= GATE).length;
  const left = data.season.end ? daysLeft(data.season.end * 1000, data.updatedAt * 1000) : null;

  const key = rp != null ? graceKey(data, rp) : "default";
  const grace = data.updatedAt < data.rule.graceFrom ? data.rule.grace.default : data.rule.grace[key];
  const quit = rp != null && data.quitTicks ? quitRp(rp, data.quitTicks[key], data.rule.step, data.rule.floor) : null;
  const rank = rp != null ? boardRank(data.rps, rp) : null;

  return (
    <table className="w-full table-fixed border-t-2 border-ink text-right num">
      <caption className="sr-only">이터니티와 데미갓의 지금 컷, 종료 예상, 내 RP와의 차이</caption>
      <colgroup>
        <col className="w-[112px] sm:w-[136px]" />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr>
          <td />
          {tiers.map(({ key, name, color }) => (
            <th key={key} scope="col" className="pt-3 pb-1 pl-2 text-[13px] font-semibold">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-1" style={{ background: color }} aria-hidden="true" />
                {name}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" className="pt-1 pb-3 pr-2 text-left align-baseline text-[13px] font-semibold whitespace-nowrap text-ink-2">{ended ? "종료 컷" : "지금 컷"}</th>
          {tiers.map(({ key, t, floor }) => {
            const day = floor || ended ? null : dayDelta(t, data.updatedAt);
            return (
              <td key={key} className="pt-1 pb-3 pl-2 align-baseline">
                <span className="text-[32px] leading-none font-bold tracking-[-1px] sm:text-[40px]">
                  {!floor && t.estimated && <span className="mr-1.5 text-[13px] font-semibold tracking-normal text-ink-3">약</span>}
                  {t.cut != null ? int(t.cut) : "-"}
                </span>
                {day && (
                  <Sub>
                    {dayName(day[0], data.updatedAt)} 9시보다 {day[1] > 0 ? `▲${int(day[1])}` : day[1] < 0 ? `▼${int(-day[1])}` : "변동 없음"}
                  </Sub>
                )}
                {!floor && t.board != null && t.cut != null && int(t.board) !== int(t.cut) && <Sub>순위표 {int(t.board)}</Sub>}
              </td>
            );
          })}
        </tr>
        {/* 이터런 인원은 한 번 도달한 뒤 내려간 계정까지 세므로 「이상」이라 부르지 않음 */}
        {seats && (
          <Row label={`${int(GATE)} ${live ? "달성" : "이상"}`}>
            {tiers.map(({ key, t }) => {
              const head = floorHead(data.rps, t.place);
              return (
                <td key={key} className={CELL}>
                  <span className="text-[20px] leading-none font-bold sm:text-[24px]">
                    {live ? <RaceCount max={t.place} /> : int(Math.min(reached, t.place))}
                    <span className="text-[13px] font-semibold text-ink-3">/{int(t.place)}명</span>
                  </span>
                  {head?.rank === t.place && (
                    <Sub>
                      {int(t.place)}위 {int(head.rp)}
                    </Sub>
                  )}
                </td>
              );
            })}
          </Row>
        )}
        {ends && (
          <Row label="종료 예상">
            {tiers.map(({ key, end }) => (
              <td key={key} className={CELL}>
                <span className="text-[20px] leading-none font-bold sm:text-[24px]">{end ? tens(end[1]) : "-"}</span>
                {end && (
                  <Sub>
                    {tens(end[2])}~{tens(end[3])}
                  </Sub>
                )}
              </td>
            ))}
          </Row>
        )}
        <tr className="border-t border-rule-2">
          <th scope="row" className="py-3 pr-2 text-left align-middle text-[13px] font-semibold whitespace-nowrap text-ink-2">
            <label htmlFor="my-rp">내 RP</label>
          </th>
          <td colSpan={2} className="py-3 pl-2">
            <div className="relative">
              <input
                id="my-rp"
                className="field num"
                inputMode="numeric"
                autoComplete="off"
                aria-describedby={rank ? "my-rank" : undefined}
                value={text}
                onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              />
              {rank && (
                <span id="my-rank" className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-ink-3">
                  {rank.tied ? "공동 " : ""}
                  {int(rank.rank)}위
                </span>
              )}
            </div>
          </td>
        </tr>
      </tbody>
      {rp != null && (
        <tbody aria-live="polite">
          <Row label={ended ? "종료 컷과 차이" : "지금 컷까지"}>
            {tiers.map(({ key, t }) => (
              <td key={key} className={CELL}>
                {t.cut == null ? "-" : <span className={VAL}>{gapText(t.cut - rp)}</span>}
              </td>
            ))}
          </Row>
          {ends && (
            <>
              <Row label="종료 예상까지">
                {tiers.map(({ key, goal }) => (
                  <td key={key} className={CELL}>
                    {goal == null ? "-" : <span className={VAL}>{gapText(goal - rp)}</span>}
                    {goal != null && goal > rp && !!left && <Sub>하루 {int(Math.ceil((goal - rp) / left))} RP씩</Sub>}
                  </td>
                ))}
              </Row>
              <Row label="달성 가능성" sub="지금 RP로 끝나면">
                {tiers.map(({ key, end, goal }) => (
                  <td key={key} className={CELL}>
                    {end && goal != null ? <span className={VAL}>{chanceLabel(chance(rp, goal, end[4], end[3]))}</span> : "-"}
                  </td>
                ))}
              </Row>
              {/* 쉬어도 RP가 깎이지 않으면 종료 예상까지 행과 값이 같아 뺌 */}
              {quit != null && quit !== rp && (
                <Row
                  label="오늘부터 쉬면"
                  sub={
                    <>
                      종료 때 {int(quit)} RP
                      <br />
                      유예 {grace}일 가정
                    </>
                  }
                >
                  {tiers.map(({ key, goal }) => (
                    <td key={key} className={CELL}>
                      {goal == null ? "-" : <span className={VAL}>{gapText(goal - quit)}</span>}
                    </td>
                  ))}
                </Row>
              )}
            </>
          )}
        </tbody>
      )}
    </table>
  );
}
