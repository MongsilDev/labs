import { type CutData, DAY, dayStart, md, TIERS } from "@/er/lib/cut";

// 12.7 패치. 유예 상한이 티어별로 바뀜
const PATCH = { day: "2026-10-29", label: "12.7 패치" };
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export default function DecayCalendar({ data }: { data: CutData }) {
  const counts = new Map<string, Record<string, number>>();
  for (const { key } of TIERS) {
    for (const [d, n] of data.tiers[key].decay) counts.set(d, { ...counts.get(d), [key]: n });
  }
  const today = new Date(data.updatedAt * 1000 + 9 * 3_600_000).toISOString().slice(0, 10);
  const lastDrop = [...counts.keys()].sort().pop();
  const seasonEnd = data.season.end ? dayStart(new Date(data.season.end * 1000 + 9 * 3_600_000).toISOString().slice(0, 10)) : Infinity;
  const until = Math.min(Math.max(dayStart(lastDrop ?? today), dayStart(PATCH.day)) + 2 * DAY, seasonEnd);
  const dates: string[] = [];
  // 오늘 15시 차감이 아직 남았으면 응답에 오늘 날짜가 들어 있음
  for (let t = dayStart(today) + (counts.has(today) ? 0 : DAY); t <= until; t += DAY) dates.push(new Date(t + 9 * 3_600_000).toISOString().slice(0, 10));
  const peak = Math.max(1, ...[...counts.values()].flatMap((c) => Object.values(c)));
  const any = [...counts.values()].some((c) => Object.values(c).some((n) => n > 0));

  return (
    <div>
      <dl className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
        {TIERS.map(({ key, name, color }) => {
          const tier = data.tiers[key];
          const total = tier.decay.reduce((s, [, n]) => s + n, 0);
          return (
            <div key={key} className="grid gap-0.5">
              <dt className="flex items-center gap-1.5 text-[13px] text-fg-3">
                <span className="size-2 rounded-full" style={{ background: color }} aria-hidden="true" />
                {name}에서 휴면 강등으로 내려갈 계정
              </dt>
              <dd className="text-[22px] leading-tight font-bold tabular-nums">{total}명</dd>
            </div>
          );
        })}
      </dl>
      {any && (
      <div className="scroll-fade overflow-x-auto pb-1" tabIndex={0}>
        <ol className="flex w-full min-w-max items-end gap-0.5 sm:gap-1" aria-label="날짜별 휴면 강등으로 컷 아래로 내려가는 인원">
          {dates.map((d) => {
            const c = counts.get(d) ?? {};
            const t = dayStart(d);
            const patch = d === PATCH.day;
            return (
              <li key={d} className="grid min-w-[18px] flex-1 grid-cols-[minmax(0,1fr)] justify-items-center gap-1 text-center sm:min-w-10">
                <div className="flex h-[112px] w-full items-end justify-center gap-px sm:gap-[3px]">
                  {TIERS.map(({ key, name, color }) => {
                    const n = c[key] ?? 0;
                    return (
                      <div key={key} className="grid w-2 justify-items-center gap-0.5 sm:w-[clamp(16px,28%,24px)]" data-tip={`${name} ${n}명`}>
                        {n > 0 && <span className="text-[10px] font-bold tracking-[-0.5px] whitespace-nowrap tabular-nums text-fg-2 sm:text-[11px] sm:tracking-normal">{n}</span>}
                        <span className="block w-full rounded-t-[2px] sm:w-[88%]" style={{ height: n ? Math.max(4, (n / peak) * 88) : 2, background: n ? color : "var(--line)" }} />
                      </div>
                    );
                  })}
                </div>
                <span className={`text-[11px] whitespace-nowrap tabular-nums sm:text-[12px] ${patch ? "font-bold text-fg" : "text-fg-3"}`}>
                  <span className="max-sm:hidden">{md(t)}</span>
                  <span className="sm:hidden">{d.endsWith("-01") ? md(t) : Number(d.slice(8))}</span>
                </span>
                <span className="text-[11px] text-fg-3">{WEEK[new Date(t + 9 * 3_600_000).getUTCDay()]}</span>
                <span className="relative h-4 w-full">
                  {patch && <span className="absolute left-1/2 -translate-x-1/2 text-[11px] font-bold whitespace-nowrap text-fg">{PATCH.label}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      )}
    </div>
  );
}
