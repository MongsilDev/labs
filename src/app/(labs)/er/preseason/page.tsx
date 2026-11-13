import Image from "next/image";
import { avatarUrl, currentUser } from "@/er/server/auth";
import Live from "@/next/Live";
import MoreRows from "./MoreRows";
import { EXP_NAME, EXP_ORDER, getPreseason, type PreChar, type PreStat } from "@/next/preseason";

export const dynamic = "force-dynamic";
export const metadata = { title: "프리 시즌 신규 요소" };

const n = (v: number) => v.toLocaleString("ko-KR");
const server = (name: string) => name.replace(/^Asia(\d?)$/, (_, k) => `아시아${k || 1}`);
const servers = (list: { name: string }[]) => (list.length > 2 ? "전체 서버" : list.map((x) => server(x.name)).join(", "));
// 모드 평균 승률과의 차이가 95% 범위를 넘을 때만 칠함
const tint = (s: PreStat, base: number) =>
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

const clock = (sec: number | null) => (sec == null ? "-" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);
const signed = (v: number) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));

export default async function PreseasonPage() {
  const me = await currentUser();
  const user = me ? { name: me.name, avatar: avatarUrl(me) } : null;
  const data = await getPreseason();
  if (!data) return <Live user={user}><h1 className="text-[26px] font-black">프리 시즌 신규 요소</h1><p className="mt-3 text-ink-3" role="status">아직 집계한 프리 시즌 경기가 없습니다.</p></Live>;
  const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
  const fmt = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric" });
  // Intl은 정오를 「오후 12시」, 자정을 「오전 12시」로 적음
  const hour = (t: number) => fmt.format(t).replace("오후 12시", "낮 12시").replace("오전 12시", "밤 12시");
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
          <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
            <MoreRows
              head={
                <thead>
                  <tr>
                    <th className="pin-n">#</th>
                    <th className="l pin-c">실험체</th>
                    <th>등급</th>
                    <th>점수</th>
                    <th>픽률</th>
                    <th>승률</th>
                    <th>TOP 3</th>
                    <th>평균 순위</th>
                  </tr>
                </thead>
              }
            >
              {data.tier.combos.map((c, i) => (
                <tr key={`${c.char}-${c.weapon}`} className={c.n < data.tier!.thin ? "opacity-50" : undefined}>
                  <td className="pin-n text-ink-3">{i + 1}</td>
                  <td className="l pin-c"><Who c={c} /></td>
                  <td><span className={`grade grade-${c.grade}`}>{c.grade}</span></td>
                  <td className="font-bold">{signed(c.z)}</td>
                  <td><small className="mr-1.5 text-ink-3">{n(c.n)}판</small>{c.pick.toFixed(2)}%</td>
                  <td>{c.win.toFixed(1)}%</td>
                  <td>{c.top3.toFixed(1)}%</td>
                  <td>{c.place.toFixed(2)}</td>
                </tr>
              ))}
            </MoreRows>
          </div>
        </section>
      )}

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
                <table className="tbl mt-2">
                  <thead>
                    <tr>
                      <th className="l">승률 상위</th>
                      <th>승률</th>
                      <th>명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {w.top.map((c) => (
                      <tr key={`${c.char}-${c.weapon}`}>
                        <td className="l"><Who c={c} /></td>
                        <td className="font-bold" style={tint(c, data.base)} data-tip={`평균 승률 ${data.base}%, 95% 범위 ±${c.winCi}`}>{c.win.toFixed(1)}%</td>
                        <td className="text-ink-3">{n(c.n)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-[13px] text-ink-3">40명 이상인 실험체가 아직 없습니다.</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="sec mt-10 min-w-0">
        <h2 className="sec-h">실험체별 실험 과제<small className="num">30명 이상</small></h2>
        {data.expChars.length ? (
          <div className="scroll-fade -mx-4 px-4 lg:mx-0 lg:px-0">
            <MoreRows
              head={
                <thead>
                  <tr>
                    <th className="l">실험체</th>
                    {EXP_ORDER.map((t) => <th key={t}>{EXP_NAME[t]}</th>)}
                    <th>명</th>
                  </tr>
                </thead>
              }
            >
              {data.expChars.map((c) => {
                const top = Math.max(...EXP_ORDER.map((t) => c.exp[t] ?? 0));
                return (
                  <tr key={`${c.char}-${c.weapon}`}>
                    <td className="l"><Who c={c} /></td>
                    {EXP_ORDER.map((t) => <td key={t} className={c.exp[t] === top ? "font-bold" : "text-ink-3"}>{(c.exp[t] ?? 0).toFixed(1)}%</td>)}
                    <td className="text-ink-3">{n(c.n)}</td>
                  </tr>
                );
              })}
            </MoreRows>
          </div>
        ) : (
          <p className="text-[13px] text-ink-3">30명 이상인 실험체가 아직 없습니다.</p>
        )}
      </section>

      <p className="mt-12 text-[13px] text-ink-3">자료: 이터널 리턴 공식 API</p>
    </Live>
  );
}
