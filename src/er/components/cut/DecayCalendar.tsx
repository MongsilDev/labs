import { type CutData, DAY, dayStart, md, TIERS } from "@/er/lib/cut";

// 12.7 패치. 이터니티 유예 상한 8, 데미갓 10으로 줄어듦
const PATCH = { day: "2026-10-29", label: "12.7" };
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default function DecayCalendar({ data }: { data: CutData }) {
  const counts = new Map<string, Record<string, number>>();
  for (const { key } of TIERS) {
    for (const [d, n] of data.tiers[key].decay) counts.set(d, { ...counts.get(d), [key]: n });
  }
  const today = new Date(data.updatedAt * 1000 + 9 * 3_600_000).toISOString().slice(0, 10);
  const lastDrop = [...counts.keys()].sort().pop();
  const until = Math.max(dayStart(lastDrop ?? today), dayStart(PATCH.day)) + 2 * DAY;
  const dates: string[] = [];
  for (let t = dayStart(today) + DAY; t <= until; t += DAY) dates.push(new Date(t + 9 * 3_600_000).toISOString().slice(0, 10));
  const peak = Math.max(1, ...[...counts.values()].flatMap((c) => Object.values(c)));

  return (
    <div>
      <dl className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
        {TIERS.map(({ key, name, color }) => {
          const tier = data.tiers[key];
          const total = tier.decay.reduce((s, [, n]) => s + n, 0) + tier.decayStay;
          return (
            <div key={key} className="grid gap-0.5">
              <dt className="flex items-center gap-1.5 text-[13px] text-fg-3">
                <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                {name} 컷 위 휴면 계정
              </dt>
              <dd className="text-[22px] leading-tight font-extrabold tabular-nums">{total}명</dd>
            </div>
          );
        })}
      </dl>
      <div className="scroll-fade overflow-x-auto pb-1" tabIndex={0}>
        <ol className="flex w-full min-w-max items-end gap-1" aria-label="날짜별 휴면 강등으로 컷 아래로 내려가는 인원">
          {dates.map((d) => {
            const c = counts.get(d) ?? {};
            const t = dayStart(d);
            const patch = d === PATCH.day;
            return (
              <li key={d} className="grid min-w-10 flex-1 justify-items-center gap-1 text-center">
                <div className="flex h-[112px] w-full items-end justify-center gap-[3px]">
                  {TIERS.map(({ key, name, color }) => {
                    const n = c[key] ?? 0;
                    return (
                      <div key={key} className="grid w-[clamp(16px,28%,24px)] justify-items-center gap-0.5" title={`${name} ${n}명`}>
                        {n > 0 && <span className="text-[11px] font-bold whitespace-nowrap tabular-nums text-fg-2">{n}</span>}
                        <span className="block w-[88%] rounded-t-[2px]" style={{ height: n ? Math.max(4, (n / peak) * 88) : 2, background: n ? color : "var(--line)" }} />
                      </div>
                    );
                  })}
                </div>
                <span className={`text-[12px] tabular-nums ${patch ? "font-bold text-fg" : "text-fg-3"}`}>{md(t)}</span>
                <span className="text-[11px] text-fg-3">{patch ? PATCH.label : WEEK[new Date(t + 9 * 3_600_000).getUTCDay()]}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-4 text-[13px] text-fg-3">
        {data.rule.dormantDays}일 넘게 랭크 게임을 하지 않은 계정은 유예 {data.rule.grace}일이 지난 뒤 매일 15시에 RP가 {data.rule.step}점씩 깎입니다.
        <br />
        막대는 휴면 계정이 지금 컷 아래로 내려가는 날과 인원을 표시합니다.
        <br />
        10월 29일 12.7 패치로 유예 상한이 이터니티 8일, 데미갓 10일로 줄면 휴면 계정이 더 일찍 내려갈 수 있습니다.
      </p>
    </div>
  );
}
