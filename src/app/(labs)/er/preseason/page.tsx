import Image from "next/image";
import { avatarUrl, currentUser } from "@/er/server/auth";
import Filters from "@/next/Filters";
import Live from "@/next/Live";
import SortTable from "./SortTable";
import { EXP_NAME, EXP_ORDER, getPreseason, type PreChar, type PreGrade, type PreMove } from "@/next/preseason";
import { WEAPON_SPRITE, itemIcon } from "@/er/lib/tier";

export const dynamic = "force-dynamic";
export const metadata = { title: "실험실" };

const GRADES: PreGrade[] = ["S", "A", "B", "C", "D"];
const MODE_NAME: Record<number, string> = { 2: "일반", 3: "랭크" };

const n = (v: number) => v.toLocaleString("ko-KR");
const server = (name: string) => name.replace(/^Asia(\d?)$/, (_, k) => `아시아${k || 1}`);
const servers = (list: { name: string }[]) => (list.length > 2 ? "전체 서버" : list.map((x) => server(x.name)).join(", "));
const ci = (win: number, k: number) => (k ? 1.96 * Math.sqrt(((win / 100) * (1 - win / 100)) / k) * 100 : 0);
// 기준 승률과의 차이가 95% 범위를 넘는 칸만 칠함. 농도는 차이에 비례
const tint = (win: number, range: number, base: number) =>
  Math.abs(win - base) <= range ? undefined : { background: `color-mix(in srgb, var(${win > base ? "--up" : "--down"}) ${Math.round(Math.min(Math.abs(win - base) / 10, 1) * 50)}%, transparent)` };
// 평균 순위는 낮을수록 좋음. 견주는 값과 95% 범위를 넘게 다를 때만 칠함
const rankTint = (rank: number | null, rest: number | null, range?: number | null) =>
  rank == null || rest == null || range == null || Math.abs(rank - rest) <= range
    ? undefined
    : { background: `color-mix(in srgb, var(${rank < rest ? "--up" : "--down"}) ${Math.round(Math.min(Math.abs(rank - rest) / 0.5, 1) * 40) + 10}%, transparent)` };
const pp = (v: number, k: number) => `${v > 0 ? "+" : ""}${v.toFixed(k)}%p`;
const clock = (sec: number | null) => (sec == null ? "-" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);

/** 무기와 실험체 이름을 한 줄로. 휴대폰 폭에서는 무기 이름 자리에 무기 아이콘을 두고, slim이면 무기를 숨김 */
function Who({ c, slim }: { c: PreChar; slim?: boolean }) {
  const w = WEAPON_SPRITE.indexOf(c.weapon);
  return (
    <span className={`inline-flex items-center whitespace-nowrap ${slim ? "gap-1 max-sm:text-[13px] sm:gap-2" : "gap-1.5 sm:gap-2"}`}>
      {/* max-w-none이 없으면 이미지 폭이 칸 폭 계산에서 빠져 이름이 칸 밖으로 넘침 */}
      <Image className="portrait max-w-none shrink-0" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
      {!slim && w >= 0 && <span className="wg sm:hidden" style={{ ["--i" as string]: w }} role="img" aria-label={c.weaponName} data-tip={c.weaponName} />}
      <span>
        <span className={slim || w >= 0 ? "text-ink-3 max-sm:hidden" : "text-ink-3"}>{c.weaponName} </span>
        <b className="font-semibold">{c.name}</b>
      </span>
    </span>
  );
}

/** 값 앞에 놓는 막대. 같은 열의 가장 큰 값이 꽉 찬 길이 */
function Bar({ v, max }: { v: number; max: number }) {
  return (
    <span className="mr-2 hidden h-[6px] w-20 bg-row align-middle sm:inline-block" aria-hidden>
      <span className="block h-full bg-ink-3" style={{ width: `${Math.min(v / max, 1) * 100}%` }} />
    </span>
  );
}

/** 등급마다 한 줄씩 실험체 얼굴을 늘어놓음. 얼굴 오른쪽 아래 칸은 무기 */
function Board({ list, note }: { list: (PreChar & { grade: PreGrade })[]; note: (i: number) => string }) {
  return (
    <div className="mt-3 border-t border-rule">
      {GRADES.map((g) => {
        const row = list.map((c, i) => ({ c, i })).filter((x) => x.c.grade === g);
        if (!row.length) return null;
        return (
          <div key={g} className="flex items-start gap-3 border-b border-rule py-2">
            <span className={`grade grade-${g} h-10 w-7 flex-none text-[15px] sm:h-11`}>{g}</span>
            <ul className="flex flex-wrap gap-1">
              {row.map(({ c, i }) => {
                const w = WEAPON_SPRITE.indexOf(c.weapon);
                return (
                  <li key={`${c.char}-${c.weapon}`} className="relative size-10 sm:size-11" data-tip={note(i)}>
                    <Image className="size-full rounded-[2px] bg-row object-cover" src={`/img/er/char/${c.key}.v1.webp`} alt={`${c.weaponName} ${c.name}`} width={44} height={44} unoptimized />
                    {w >= 0 && (
                      <span className="absolute right-0 bottom-0 grid size-[18px] place-items-center overflow-hidden rounded-tl-[2px] bg-bg" aria-hidden>
                        <span className="wg scale-[0.89] bg-ink" style={{ ["--i" as string]: w }} />
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function Moves({ head, list, avg }: { head: string; list: PreMove[]; avg: string }) {
  return (
    <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
      <table className="tbl snug">
        <thead>
          <tr>
            <th className="l">{head}</th>
            <th>승률</th>
            <th data-tip={`두 기간의 평균 승률 차이 ${avg}를 뺀 값`}>승률 변화</th>
            <th>픽률 변화</th>
          </tr>
        </thead>
        <tbody>
          {[...list].sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).map((c) => (
            <tr key={`${c.char}-${c.weapon}`}>
              <td className="l"><Who c={c} /></td>
              <td>{c.win.toFixed(1)}%</td>
              <td className="font-bold" style={{ color: `var(${c.d > 0 ? "--up" : "--down"})` }} data-tip={`${n(c.n)}명, 95% 범위 ±${c.dCi}%p`}>{pp(c.d, 1)}</td>
              <td className="text-ink-3">{pp(c.dPick, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 분야 이름. 휴대폰 폭에서는 「공학」을 숨김 */
const field = (name: string) => {
  const i = name.lastIndexOf(" ");
  return i < 0 ? name : <>{name.slice(0, i)}<span className="max-sm:hidden">{name.slice(i)}</span></>;
};

function How({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-4 text-[13px] text-ink-2">
      <summary className="w-fit cursor-pointer text-ink-3">계산 방법</summary>
      <ul className="mt-2 grid max-w-[720px] list-disc gap-1 pl-5">{children}</ul>
    </details>
  );
}

export default async function PreseasonPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const me = await currentUser();
  const user = me ? { name: me.name, avatar: avatarUrl(me) } : null;
  const data = await getPreseason();
  if (!data) return <Live user={user}><h1 className="text-[26px] font-black">실험실</h1><p className="mt-3 text-ink-3" role="status">아직 집계한 프리 시즌 경기가 없습니다.</p></Live>;
  const cobalt = (await searchParams).mode === "cobalt" ? data.cobalt : null;
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  const fmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" });
  const hour = (t: number) => fmt.format(t);
  const [from, to] = cobalt ? [cobalt.from, cobalt.to] : [data.from, data.to];
  const span = day.format(from) === day.format(to)
    ? `${day.format(from)} ${hour(from)}~${hour(to).replace(/^(오전|오후) /, (m) => (hour(from).startsWith(m) ? "" : m))}`
    : `${day.format(from)} ${hour(from)}~${day.format(to)} ${hour(to)}`;
  const exp = EXP_ORDER.map((t) => data.exp.rows.find((r) => r.type === t)).filter((r) => r != null);
  // 예전 경기를 다시 받기 전에는 값이 없어 칸을 숨김
  const step1 = exp.some((r) => r.step1 != null);
  const step2 = exp.some((r) => r.step2 != null);
  const tier = data.tier?.combos ?? [];
  const maxPick = Math.max(...(cobalt?.combos ?? tier).map((c) => c.pick), 0.01);
  // 견줄 직전 시즌 경기를 다 받기 전에는 비교 표가 없음
  const moves = !!data.change && data.change.up.length + data.change.down.length > 0;
  const modes = (data.modes ?? []).filter((m) => m.games).sort((a, b) => b.games - a.games).map((m) => `${MODE_NAME[m.mode] ?? m.mode} ${n(m.games)}경기`);
  return (
    <Live user={user}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">실험실</h1>
        <p className="text-[13px] text-ink-3 num" data-tip={`갱신 ${day.format(data.updatedAt)} ${hour(data.updatedAt)}`}>
          <span className="whitespace-nowrap">{data.season.name}, {cobalt ? "" : `${servers(data.servers)} `}{n(cobalt ? cobalt.games : data.games)}경기,</span>{" "}
          <span className="whitespace-nowrap">{span}</span>
        </p>
      </div>
      {data.cobalt && (
        <Filters
          groups={[{
            name: "모드",
            items: [
              { href: "/er/preseason", label: "일반과 랭크", on: !cobalt },
              { href: "/er/preseason?mode=cobalt", label: "코발트 프로토콜", on: !!cobalt },
            ],
          }]}
        />
      )}

      {cobalt ? (
        <>
          <section className="sec mt-6 min-w-0">
            <h2 className="sec-h">티어리스트</h2>
            <Board list={cobalt.combos} note={(i) => `${cobalt.combos[i].weaponName} ${cobalt.combos[i].name}, 승률 ${cobalt.combos[i].win.toFixed(1)}%`} />
            <How>
              <li>코발트 프로토콜은 4인 두 팀 경기라 순위 없이 승률만 셉니다.</li>
              <li>등급은 승률의 순위로 나눕니다.</li>
              <li>S는 위 10%, A는 다음 20%, B는 40%, C는 20%, D는 아래 10%입니다.</li>
              <li>판 수가 적은 조합은 승률을 전체 승률 {cobalt.base}% 쪽으로 당겨서 순위를 매깁니다.</li>
              <li>픽률은 팀 가운데 그 실험체와 무기 조합을 고른 팀의 비율입니다.</li>
              <li>승률 칸은 전체 승률과 95% 범위를 넘게 다를 때 칠합니다.</li>
            </How>
          </section>
          <section className="sec mt-10 min-w-0 xl:w-[calc(60%-16px)]">
            <h2 className="sec-h">실험체 통계</h2>
            <SortTable
              numbered
              cols={[
                { label: "실험체", cls: "l w-px sm:pr-6" },
                { label: "등급", first: "asc" },
                { label: "픽률", first: "desc" },
                { label: "승률", first: "desc" },
                { label: "명", first: "desc", cls: "max-sm:hidden" },
              ]}
              rows={cobalt.combos.map((c, i) => ({
                id: `${c.char}-${c.weapon}`,
                no: i + 1,
                vals: [null, i, c.pick, c.win, c.n],
                cells: (
                  <>
                    <td className="l w-px sm:pr-6"><Who c={c} /></td>
                    <td><span className={`grade grade-${c.grade}`}>{c.grade}</span></td>
                    <td><Bar v={c.pick} max={maxPick} />{c.pick.toFixed(2)}%</td>
                    <td className="font-bold" style={tint(c.win, c.winCi, cobalt.base)} data-tip={`${n(c.n)}명, 95% 범위 ±${c.winCi}`}>{c.win.toFixed(1)}%</td>
                    <td className="text-ink-3 max-sm:hidden">{n(c.n)}</td>
                  </>
                ),
              }))}
            />
          </section>
        </>
      ) : (
        <>
          {data.tier && (
            <>
              <section className="sec mt-6 min-w-0">
                <h2 className="sec-h">티어리스트</h2>
                <Board list={tier} note={(i) => `${tier[i].weaponName} ${tier[i].name}, 평균 ${tier[i].place.toFixed(2)}위`} />
                <How>
                  {modes.length > 0 && <li>봇을 뺀 {modes.join("와 ")}를 합쳐 셉니다.</li>}
                  <li>등급은 평균 순위와 TOP 3 비율을 반씩 합친 점수의 순위로 나눕니다.</li>
                  <li>S는 위 10%, A는 다음 20%, B는 40%, C는 20%, D는 아래 10%입니다.</li>
                  <li>판 수가 적은 무기는 점수를 같은 실험체의 모든 무기를 합친 점수에 가깝게 맞춥니다.</li>
                  <li>픽률은 사람이 한 명 이상 있는 팀 가운데 그 실험체와 무기 조합을 고른 팀의 비율입니다.</li>
                  <li>승률 칸은 평균 승률 {data.base}%와 95% 범위를 넘게 다를 때 칠합니다.</li>
                </How>
              </section>
            </>
          )}

          <div className={`mt-10 grid items-start gap-10 ${data.tier && moves ? "xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : ""}`}>
          {data.tier && (
            <>
              <section className="sec min-w-0">
                <h2 className="sec-h">실험체 통계</h2>
                <SortTable
                  numbered
                  cols={[
                    { label: "실험체", cls: "l w-px sm:pr-6" },
                    { label: "등급", first: "asc" },
                    { label: "픽률", first: "desc" },
                    { label: "승률", first: "desc" },
                    { label: "TOP 3", first: "desc", cls: "max-sm:hidden" },
                    { label: "평균 순위", first: "asc" },
                  ]}
                  rows={tier.map((c, i) => ({
                    id: `${c.char}-${c.weapon}`,
                    no: i + 1,
                    dim: c.n < data.tier!.thin,
                    // 프리 시즌 점수는 RP가 아닌 표준편차 배수라 숫자를 숨김. 등급 열의 정렬 값은 점수 순위
                    vals: [null, i, c.pick, c.win, c.top3, c.place],
                    cells: (
                      <>
                        <td className="l w-px sm:pr-6"><Who c={c} /></td>
                        <td><span className={`grade grade-${c.grade}`}>{c.grade}</span></td>
                        <td data-tip={`${n(c.n)}명`}><Bar v={c.pick} max={maxPick} />{c.pick.toFixed(2)}%</td>
                        <td className="font-bold" style={tint(c.win, ci(c.win, c.n), data.base)}>{c.win.toFixed(1)}%</td>
                        <td className="max-sm:hidden">{c.top3.toFixed(1)}%</td>
                        <td>{c.place.toFixed(2)}</td>
                      </>
                    ),
                  }))}
                />
              </section>
            </>
          )}

          {data.change && moves ? (
            <section className="sec min-w-0">
              <h2 className="sec-h">
                시즌 {Number(data.season.name.replace(/\D/g, "")) - 1} 대비
                <small className="num">
                  {day.format(data.change.from) === day.format(data.change.to) ? day.format(data.change.from) : `${day.format(data.change.from)}~${day.format(data.change.to)}`} {n(data.change.games)}경기
                </small>
              </h2>
              <div className="grid items-start gap-8 lg:grid-cols-2 xl:grid-cols-1">
                <Moves head="승률이 오른 실험체" list={data.change.up} avg={`${data.change.avgThen}%→${data.change.avgNow}%`} />
                <Moves head="승률이 내린 실험체" list={data.change.down} avg={`${data.change.avgThen}%→${data.change.avgNow}%`} />
              </div>
            </section>
          ) : null}
          </div>

          {data.trios?.length ? (
            <section className="sec mt-10 min-w-0">
              <h2 className="sec-h">3인 조합<small className="num">30팀 이상</small></h2>
              <SortTable
                show={10}
                cols={[{ label: "조합", cls: "l" }, { label: "팀", first: "desc", cls: "max-sm:hidden" }, { label: "승률", first: "desc" }, { label: "TOP 3", first: "desc", cls: "max-sm:hidden" }, { label: "평균 순위", first: "asc", cls: "max-[399px]:hidden" }]}
                rows={data.trios.map((t) => ({
                  id: t.key,
                  vals: [null, t.n, t.win, t.top3, t.rank],
                  cells: (
                    <>
                      <td className="l">
                        <span className="inline-flex gap-x-2.5 sm:gap-x-5">{t.members.map((c) => <Who key={`${c.char}-${c.weapon}`} c={c} slim />)}</span>
                      </td>
                      <td className="text-ink-3 max-sm:hidden">{n(t.n)}</td>
                      <td className="font-bold" style={tint(t.win, t.winCi, data.base)} data-tip={`${n(t.n)}팀, 평균 승률 ${data.base}%, 95% 범위 ±${t.winCi}`}>{t.win.toFixed(1)}%</td>
                      <td className="max-sm:hidden">{t.top3.toFixed(1)}%</td>
                      <td className="max-[399px]:hidden">{t.rank?.toFixed(2) ?? "-"}</td>
                    </>
                  ),
                }))}
              />
            </section>
          ) : null}

          <div className="mt-10 grid items-start gap-10 lg:grid-cols-2 xl:grid-cols-3">
            <section className="sec min-w-0">
              <h2 className="sec-h">실험 과제<small className="num">{n(data.exp.teams)}팀</small></h2>
              <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="tbl snug">
                <thead>
                  <tr>
                    <th className="l">완료한 분야</th>
                    <th>비율</th>
                    <th>평균 순위</th>
                    <th>승률</th>
                    {step1 && <th data-tip="1단계를 처음 완료하기까지 걸린 평균 시간">1단계 시간</th>}
                    {step2 && <th data-tip="2단계를 완료한 팀의 평균 완료 횟수">2단계 횟수</th>}
                  </tr>
                </thead>
                <tbody>
                  {[...exp, { ...data.exp.none, type: "none", name: "미완료", step1: null, step2: null }].map((r) => (
                    <tr key={r.type} className={r.type === "none" ? "text-ink-3" : undefined}>
                      <td className={r.type === "none" ? "l" : "l font-semibold"}>{r.type === "none" ? r.name : field(r.name)}</td>
                      <td>{r.share.toFixed(1)}%</td>
                      <td>{r.rank?.toFixed(2) ?? "-"}</td>
                      <td className="font-bold" style={tint(r.win, r.winCi, data.base)} data-tip={`${n(r.n)}팀, 평균 승률 ${data.base}%, 95% 범위 ±${r.winCi}`}>{r.win.toFixed(1)}%</td>
                      {step1 && <td>{r.type === "none" ? "" : clock(r.step1)}</td>}
                      {step2 && <td>{r.step2 == null ? "" : `${r.step2.toFixed(1)}회`}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>

            {data.armor?.length ? (
              <section className="sec min-w-0">
                <h2 className="sec-h">신규 방어구<small className="num">경기 종료 때 낀 장비, {n(data.equipGames ?? 0)}경기</small></h2>
                <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
                <table className="tbl snug">
                  <thead>
                    <tr>
                      <th className="l">방어구</th>
                      <th className="max-[399px]:hidden">등급</th>
                      <th data-tip="같은 부위에 같은 등급 장비를 쓴 사람 가운데 이 방어구를 쓴 사람의 비율">채용률</th>
                      <th>평균 순위</th>
                      <th data-tip="같은 부위에 같은 등급의 다른 장비를 낀 사람의 평균 순위">같은 등급 평균</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.armor.map((a) => (
                      <tr key={a.code} className={a.n < (data.tier?.thin ?? 30) ? "opacity-50" : undefined}>
                        <td className="l">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap">
                            {itemIcon(a.code) && <Image className="portrait max-w-none shrink-0" src={itemIcon(a.code)!} alt="" width={24} height={24} unoptimized />}
                            <b className="font-semibold">{a.name}</b>
                          </span>
                        </td>
                        <td className="text-ink-3 max-[399px]:hidden">{a.grade}</td>
                        <td>{a.share.toFixed(1)}%</td>
                        <td className="font-bold" style={a.n < (data.tier?.thin ?? 30) ? undefined : rankTint(a.rank, a.restRank, a.rankCi)} data-tip={`${n(a.n)}명, 승률 ${a.win.toFixed(1)}%`}>{a.rank?.toFixed(2) ?? "-"}</td>
                        <td className="text-ink-3" data-tip={a.restWin == null ? undefined : `승률 ${a.restWin.toFixed(1)}%`}>{a.restRank?.toFixed(2) ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </section>
            ) : null}

            <section className="sec min-w-0">
              <h2 className="sec-h">날씨</h2>
              <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="l">날씨</th>
                    <th>경기</th>
                    <th className="l">지급품</th>
                    <th data-tip="지급품을 얻은 사람의 비율">획득</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weather.map((w) => (
                    <tr key={w.code}>
                      <td className="l font-semibold">{w.name}</td>
                      <td>{(w.share ?? (w.games / data.games) * 100).toFixed(1)}%</td>
                      <td className="l text-ink-3">{w.drop ?? "없음"}</td>
                      <td>{w.drop ? `${w.dropShare.toFixed(1)}%` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </section>
          </div>

          {data.expChars.length ? (
            <section className="sec mt-10 min-w-0">
              <h2 className="sec-h">실험체별 실험 과제<small className="num">30명 이상</small></h2>
              <SortTable
                groups={[{ label: "", span: 1 }, { label: "완료한 분야 비율", span: 3, cls: "max-sm:hidden" }, { label: "평균 순위", span: 3 }, { label: "", span: 1, cls: "max-sm:hidden" }]}
                cols={[
                  { label: "실험체", cls: "l" },
                  ...EXP_ORDER.map((t, i) => ({ label: EXP_NAME[t], first: "desc" as const, cls: i ? "max-sm:hidden" : "grp-l max-sm:hidden" })),
                  ...EXP_ORDER.map((t, i) => ({ label: field(EXP_NAME[t]), first: "asc" as const, cls: i ? undefined : "grp-l" })),
                  { label: "명", first: "desc", cls: "grp-l max-sm:hidden" },
                ]}
                rows={data.expChars.map((c) => ({
                  id: `${c.char}-${c.weapon}`,
                  vals: [null, ...EXP_ORDER.map((t) => c.exp[t] ?? 0), ...EXP_ORDER.map((t) => c.rank?.[t] ?? null), c.n],
                  cells: (
                    <>
                      <td className="l"><Who c={c} /></td>
                      {EXP_ORDER.map((t, i) => (
                        <td key={t} className={`max-sm:hidden ${i ? "text-ink-2" : "grp-l text-ink-2"}`}>{(c.exp[t] ?? 0).toFixed(1)}%</td>
                      ))}
                      {EXP_ORDER.map((t, i) => {
                        const rank = c.rank?.[t];
                        const best = c.best === t;
                        return (
                          <td
                            key={t}
                            className={`${i ? "" : "grp-l "}${best ? "font-bold" : "text-ink-2"}`}
                            data-tip={rank == null ? undefined : `완료 ${(c.exp[t] ?? 0).toFixed(1)}%, TOP 3 ${c.top3?.[t]?.toFixed(1)}%`}
                          >
                            {rank == null ? "" : rank.toFixed(2)}
                          </td>
                        );
                      })}
                      <td className="grp-l text-ink-3 max-sm:hidden">{n(c.n)}</td>
                    </>
                  ),
                }))}
              />
            </section>
          ) : null}
        </>
      )}

      <p className="mt-12 text-[13px] text-ink-3">자료: 이터널 리턴 공식 API</p>
    </Live>
  );
}
