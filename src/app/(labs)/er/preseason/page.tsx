import Image from "next/image";
import { avatarUrl, currentUser } from "@/er/server/auth";
import Live from "@/next/Live";
import SortTable from "./SortTable";
import { EXP_NAME, EXP_ORDER, getPreseason, type PreChar, type PreMove, type PreStat } from "@/next/preseason";
import { itemIcon } from "@/er/lib/tier";

export const dynamic = "force-dynamic";
export const metadata = { title: "프리 시즌 신규 요소" };

const n = (v: number) => v.toLocaleString("ko-KR");
const server = (name: string) => name.replace(/^Asia(\d?)$/, (_, k) => `아시아${k || 1}`);
const servers = (list: { name: string }[]) => (list.length > 2 ? "전체 서버" : list.map((x) => server(x.name)).join(", "));
// 모드 평균 승률과의 차이가 95% 범위를 넘을 때만 칠함
const tint = (s: { win: number; winCi: number }, base: number) =>
  Math.abs(s.win - base) <= s.winCi ? undefined : { background: `color-mix(in srgb, var(${s.win > base ? "--up" : "--down"}) ${Math.round(Math.min(Math.abs(s.win - base) / 10, 1) * 50)}%, transparent)` };

function Who({ c }: { c: PreChar }) {
  return (
    <span className="flex items-center gap-2">
      <Image className="portrait" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={24} height={24} unoptimized />
      <span className="flex flex-wrap gap-x-1.5">
        <span className="text-ink-3">{c.weaponName}</span>
        <span className="font-semibold">{c.name}</span>
      </span>
    </span>
  );
}

function Stats({ s, base }: { s: PreStat; base: number }) {
  return (
    <>
      <td>{s.share.toFixed(1)}%</td>
      <td>{s.rank?.toFixed(2) ?? "-"}</td>
      <td className="font-bold" style={tint(s, base)} data-tip={`${n(s.n)}명, 평균 승률 ${base}%, 95% 범위 ±${s.winCi}`}>{s.win.toFixed(1)}%</td>
    </>
  );
}

function Moves({ head, list, avg }: { head: string; list: PreMove[]; avg: string }) {
  const pp = (v: number, k: number) => `${v > 0 ? "+" : ""}${v.toFixed(k)}%p`;
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th className="l">{head}</th>
          <th>승률</th>
          <th>픽률</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c) => (
          <tr key={`${c.char}-${c.weapon}`}>
            <td className="l"><Who c={c} /></td>
            <td data-tip={`${n(c.n)}명, 평균 승률 차이 ${avg}를 뺀 승률 변화, 95% 범위 ±${c.dCi}%p`}>
              <span className="font-bold">{c.win.toFixed(1)}%</span>
              <small className="block" style={{ color: `var(${c.d > 0 ? "--up" : "--down"})` }}>{pp(c.d, 1)}</small>
            </td>
            <td>
              {c.pick.toFixed(2)}%
              <small className="block text-ink-3">{pp(c.dPick, 2)}</small>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const clock = (sec: number | null) => (sec == null ? "-" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);

export default async function PreseasonPage() {
  const me = await currentUser();
  const user = me ? { name: me.name, avatar: avatarUrl(me) } : null;
  const data = await getPreseason();
  if (!data) return <Live user={user}><h1 className="text-[26px] font-black">프리 시즌 신규 요소</h1><p className="mt-3 text-ink-3" role="status">아직 집계한 프리 시즌 경기가 없습니다.</p></Live>;
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  const fmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric" });
  // Intl은 정오를 「오후 12시」로 적음
  const hour = (t: number) => fmt.format(t).replace("오후 12시", "낮 12시");
  const span = day.format(data.from) === day.format(data.to)
    ? `${day.format(data.from)} ${hour(data.from)}~${hour(data.to).replace(/^(오전|오후) /, (m) => (hour(data.from).startsWith(m) ? "" : m))}`
    : `${day.format(data.from)} ${hour(data.from)}~${day.format(data.to)} ${hour(data.to)}`;
  const exp = EXP_ORDER.map((t) => data.exp.rows.find((r) => r.type === t)).filter((r) => r != null);
  // 예전 경기를 다시 받기 전에는 값이 없어 칸을 숨김
  const step1 = exp.some((r) => r.step1 != null);
  const step2 = exp.some((r) => r.step2 != null);
  const per = data.gadgets.some((g) => g.per != null);
  return (
    <Live user={user}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">{data.season.name} 신규 요소</h1>
        <p className="text-[13px] text-ink-3 num">
          {servers(data.servers)} {n(data.games)}경기, {span}
        </p>
      </div>

      {data.tier && (
        <section className="sec mt-6 min-w-0">
          <h2 className="sec-h">프리 시즌 티어리스트<small className="num">{n(data.tier.rows)}명</small></h2>
          <SortTable
            numbered
            search
            cols={[
              { label: "실험체", cls: "l pin-c" },
              { label: "등급", first: "desc" },
              { label: "픽률", first: "desc" },
              { label: "승률", first: "desc" },
              { label: "TOP 3", first: "desc" },
              { label: "평균 순위", first: "asc" },
            ]}
            rows={data.tier.combos.map((c, i) => ({
              id: `${c.char}-${c.weapon}`,
              no: i + 1,
              find: `${c.weaponName}${c.name}${c.name}${c.weaponName}`,
              dim: c.n < data.tier!.thin,
              // 프리 시즌 점수는 RP가 아니라 표준편차 배수라 숫자 대신 등급만 보이고, 등급 열은 점수로 정렬함
              vals: [null, c.z, c.pick, c.win, c.top3, c.place],
              cells: (
                <>
                  <td className="l pin-c"><Who c={c} /></td>
                  <td><span className={`grade grade-${c.grade}`}>{c.grade}</span></td>
                  <td><small className="mr-1.5 text-ink-3">{n(c.n)}판</small>{c.pick.toFixed(2)}%</td>
                  <td>{c.win.toFixed(1)}%</td>
                  <td>{c.top3.toFixed(1)}%</td>
                  <td>{c.place.toFixed(2)}</td>
                </>
              ),
            }))}
          />
        </section>
      )}

      {data.change && (data.change.up.length || data.change.down.length) ? (
        <section className="sec mt-10 min-w-0">
          <h2 className="sec-h">
            시즌 {Number(data.season.name.replace(/\D/g, "")) - 1} 대비
            <small className="num">
              {day.format(data.change.from) === day.format(data.change.to) ? day.format(data.change.from) : `${day.format(data.change.from)}~${day.format(data.change.to)}`} {n(data.change.games)}경기
            </small>
          </h2>
          <div className="grid items-start gap-10 lg:grid-cols-2">
            <Moves head="승률이 오른 실험체" list={data.change.up} avg={`${data.change.avgThen}%→${data.change.avgNow}%`} />
            <Moves head="승률이 내린 실험체" list={data.change.down} avg={`${data.change.avgThen}%→${data.change.avgNow}%`} />
          </div>
        </section>
      ) : null}

      {data.trios?.length ? (
        <section className="sec mt-10 min-w-0">
          <h2 className="sec-h">3인 조합<small className="num">30팀 이상</small></h2>
          <SortTable
            search
            show={10}
            cols={[{ label: "조합", cls: "l" }, { label: "팀", first: "desc" }, { label: "승률", first: "desc" }, { label: "TOP 3", first: "desc" }, { label: "평균 순위", first: "asc" }]}
            rows={data.trios.map((t) => ({
              id: t.key,
              find: t.members.map((c) => `${c.weaponName}${c.name}`).join(""),
              vals: [null, t.n, t.win, t.top3, t.rank],
              cells: (
                <>
                  <td className="l">
                    <span className="flex flex-wrap gap-x-4 gap-y-1">{t.members.map((c) => <Who key={`${c.char}-${c.weapon}`} c={c} />)}</span>
                  </td>
                  <td className="text-ink-3">{n(t.n)}</td>
                  <td className="font-bold" style={tint(t, data.base)} data-tip={`평균 승률 ${data.base}%, 95% 범위 ±${t.winCi}`}>{t.win.toFixed(1)}%</td>
                  <td>{t.top3.toFixed(1)}%</td>
                  <td>{t.rank?.toFixed(2) ?? "-"}</td>
                </>
              ),
            }))}
          />
        </section>
      ) : null}

      <div className="mt-10 grid gap-10 lg:grid-cols-2">
        <section className="sec min-w-0">
          <h2 className="sec-h">실험 과제<small className="num">{n(data.exp.teams)}팀</small></h2>
          <table className="tbl">
            <thead>
              <tr>
                <th className="l">완료한 분야</th>
                <th>비율</th>
                <th>평균 순위</th>
                <th>승률</th>
                {step1 && <th>1단계</th>}
                {step2 && <th>2단계</th>}
              </tr>
            </thead>
            <tbody>
              {exp.map((r) => (
                <tr key={r.type}>
                  <td className="l font-semibold">{r.name}</td>
                  <Stats s={r} base={data.base} />
                  {step1 && <td className="text-ink-3" data-tip="첫 완료까지 걸린 평균 시간">{clock(r.step1)}</td>}
                  {step2 && <td className="text-ink-3" data-tip="팀당 평균 완료 횟수">{r.step2 == null ? "-" : `${r.step2.toFixed(1)}회`}</td>}
                </tr>
              ))}
              <tr className="text-ink-3">
                <td className="l">미완료</td>
                <Stats s={data.exp.none} base={data.base} />
                {step1 && <td />}
                {step2 && <td />}
              </tr>
            </tbody>
          </table>
        </section>

        <section className="sec min-w-0">
          <h2 className="sec-h">가젯<small className="num">{n(data.players)}명</small></h2>
          <table className="tbl">
            <thead>
              <tr>
                <th className="l">쓴 가젯</th>
                <th>쓴 사람</th>
                {per && <th>판당 횟수</th>}
              </tr>
            </thead>
            <tbody>
              {data.gadgets.map((g) => (
                <tr key={g.code}>
                  <td className="l font-semibold">{g.name}</td>
                  <td>{g.share.toFixed(1)}%</td>
                  {per && <td>{g.per?.toFixed(2) ?? "-"}</td>}
                </tr>
              ))}
              <tr className="text-ink-3">
                <td className="l">쓰지 않음</td>
                <td>{data.noGadget.share.toFixed(1)}%</td>
                {per && <td />}
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      {data.armor?.length ? (
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <section className="sec min-w-0">
            <h2 className="sec-h">신규 방어구<small className="num">{n(data.equipGames ?? 0)}경기</small></h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th className="l">방어구</th>
                  <th>채용률</th>
                  <th>평균 순위</th>
                  <th>승률</th>
                </tr>
              </thead>
              <tbody>
                {data.armor.map((a) => (
                  <tr key={a.code} className={a.n < (data.tier?.thin ?? 30) ? "opacity-50" : undefined}>
                    <td className="l">
                      <span className="flex items-center gap-2">
                        {itemIcon(a.code) && <Image className="portrait" src={itemIcon(a.code)!} alt="" width={24} height={24} unoptimized />}
                        <span className="font-semibold">{a.name}</span>
                      </span>
                    </td>
                    <td data-tip={`같은 부위 ${a.grade} 장비를 쓴 사람 중`}>{a.share.toFixed(1)}%</td>
                    <td data-tip={`같은 부위 ${a.grade} 장비 ${a.restRank?.toFixed(2) ?? "-"}`}>{a.rank?.toFixed(2) ?? "-"}</td>
                    <td className="font-bold" style={a.restWin == null ? undefined : tint(a, a.restWin)} data-tip={`${n(a.n)}명, 같은 부위 ${a.grade} 장비 ${a.restWin ?? "-"}%, 95% 범위 ±${a.winCi}`}>{a.win.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      ) : null}

      <section className="sec mt-10 min-w-0">
        <h2 className="sec-h">날씨</h2>
        <div className="mt-3 grid gap-x-10 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
          {data.weather.map((w) => (
            <div key={w.code} className="min-w-0">
              <h3 className="font-bold">
                {w.name}
                <small className="ml-2 font-normal text-ink-3 num">{n(w.games)}경기</small>
              </h3>
              <p className="mt-1 text-[13px] text-ink-3 num">{w.drop ? `${w.drop} 획득 ${w.dropShare.toFixed(1)}%` : "지급품 없음"}</p>
              {w.top.length ? (
                <div className="mt-2">
                  <SortTable
                    show={5}
                    cols={[{ label: "실험체", cls: "l" }, { label: "승률", first: "desc" }, { label: "명", first: "desc" }]}
                    rows={w.top.map((c) => ({
                      id: `${c.char}-${c.weapon}`,
                      vals: [null, c.win, c.n],
                      cells: (
                        <>
                          <td className="l"><Who c={c} /></td>
                          <td className="font-bold" style={tint(c, data.base)} data-tip={`평균 승률 ${data.base}%, 95% 범위 ±${c.winCi}`}>{c.win.toFixed(1)}%</td>
                          <td className="text-ink-3">{n(c.n)}</td>
                        </>
                      ),
                    }))}
                  />
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-ink-3">40명 이상인 실험체가 아직 없습니다.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {data.expChars.length ? (
        <section className="sec mt-10 min-w-0">
          <h2 className="sec-h">실험체별 실험 과제<small className="num">30명 이상</small></h2>
          <SortTable
            search
            cols={[{ label: "실험체", cls: "l" }, ...EXP_ORDER.map((t) => ({ label: EXP_NAME[t], first: "desc" as const })), { label: "명", first: "desc" }]}
            rows={data.expChars.map((c) => {
              // 분야마다 30명 이상일 때만 성적을 적고, 평균 순위가 가장 좋은 분야를 칠함
              const ranks = EXP_ORDER.map((t) => c.rank?.[t]).filter((v): v is number => v != null);
              const best = ranks.length > 1 ? Math.min(...ranks) : null;
              const top = Math.max(...EXP_ORDER.map((t) => c.exp[t] ?? 0));
              return {
                id: `${c.char}-${c.weapon}`,
                find: `${c.weaponName}${c.name}${c.name}${c.weaponName}`,
                vals: [null, ...EXP_ORDER.map((t) => c.exp[t] ?? 0), c.n],
                cells: (
                  <>
                    <td className="l"><Who c={c} /></td>
                    {EXP_ORDER.map((t) => {
                      const rank = c.rank?.[t];
                      return (
                        <td key={t} data-tip={rank == null ? undefined : `평균 순위 ${rank.toFixed(2)}, TOP 3 ${c.top3?.[t]?.toFixed(1)}%`}>
                          <span className={c.exp[t] === top ? "font-bold" : "text-ink-3"}>{(c.exp[t] ?? 0).toFixed(1)}%</span>
                          {rank != null && <small className="block" style={rank === best ? { color: "var(--up)" } : undefined}>{rank.toFixed(2)}위</small>}
                        </td>
                      );
                    })}
                    <td className="text-ink-3">{n(c.n)}</td>
                  </>
                ),
              };
            })}
          />
        </section>
      ) : null}

      <p className="mt-12 text-[13px] text-ink-3">자료: 이터널 리턴 공식 API</p>
    </Live>
  );
}
