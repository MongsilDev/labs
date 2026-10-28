import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import Header from "@/tarkov/components/Header";
import { ALERT, METRICS, MIN_N, MIN_PEERS, PAIR, PRIOR, RATE_LABEL, SMOOTHED, TARGET_PEERS, VERDICT_LABEL, WARN, WIDTHS, type BadgeRates, type Kind, type RateMode } from "@/tarkov/lib/criteria";
import { int } from "@/tarkov/lib/format";
import { badgeRates, baselineCounts } from "@/tarkov/server/baseline";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "판정 기준", description: "Escape from Tarkov 계정 판정 배지 계산 방식" };

const pct = (q: number) => `${Math.round((1 - q) * 100)}%`;

const MODES: { kind: Kind; label: string; families: Record<string, string> }[] = [
  { kind: "eft", label: "시즌, PvP, PvE", families: { combat: "전투", streak: "연속 생존" } },
  { kind: "arena", label: "아레나 모드별", families: { kill: "킬", hs: "헤드샷", maxkills: "최다 킬", streak: "연속 킬" } },
];

const STATES = ["clear", "warn", "alert"] as const;

// 100칸에 나눠 그릴 칸 수. 남는 칸은 소수점이 큰 쪽부터
function cells(r: Record<(typeof STATES)[number], number>) {
  const n = STATES.map((k) => Math.floor(r[k]));
  const left = 100 - n.reduce((a, b) => a + b, 0);
  [...STATES.keys()].sort((a, b) => (r[STATES[b]] % 1) - (r[STATES[a]] % 1)).slice(0, left).forEach((i) => n[i]++);
  return STATES.flatMap((k, i) => Array<string>(n[i]).fill(k));
}

const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric" });

function Rates({ rates }: { rates: BadgeRates }) {
  return (
    <div className="rates">
      {(Object.keys(RATE_LABEL) as RateMode[]).map((key) => [key, rates.modes[key]] as const).map(([key, r]) => (
        <div key={key} className="rate-row">
          <div className="rate-head">
            <b>{RATE_LABEL[key]}</b>
            <span className="small muted num">{int(r.accounts)}명 판정</span>
          </div>
          <div className="rate-cells" role="img" aria-label={`${RATE_LABEL[key]} ${STATES.map((k) => `${VERDICT_LABEL[k]} ${r[k]}%`).join(", ")}`}>
            {cells(r).map((k, i) => (
              <i key={i} className={k === "clear" ? undefined : k} />
            ))}
          </div>
          <div className="rate-nums num">
            {STATES.map((k) => (
              <span key={k} className={k === "clear" ? undefined : k}>
                {VERDICT_LABEL[k]} <b>{r[k].toFixed(1)}%</b>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Criteria() {
  const counts = baselineCounts();
  const rates = badgeRates();
  return (
    <>
      <Header crumb={{ href: "/tarkov/players", label: "계정 조회" }} />
      <main id="main" className="wrap doc">
        <h1 className="page-h1">판정 기준</h1>
        <p>
          판정 배지는 공개 전적이 비슷한 계정 사이에서 이 계정의 기록이 어느 위치인지 표시합니다.
          <br />
          통계로만 판정하므로 실력이 좋거나 친구와 함께 플레이하는 계정도 높게 판정될 수 있으며, 판정 결과는 부정행위의 증거가 아닙니다.
        </p>

        <h2>배지</h2>
        <div className="doc-table">
          <table>
            <thead>
              <tr>
                <th scope="col" className="badge-col">
                  배지
                </th>
                <th scope="col">조건</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="nowrap">
                  <span className="badge sm">{VERDICT_LABEL.clear}</span>
                </td>
                <td>아래 두 조건에 해당하지 않음</td>
              </tr>
              <tr>
                <td className="nowrap">
                  <span className="badge sm warn">{VERDICT_LABEL.warn}</span>
                </td>
                <td>
                  지표 하나가 상위 {pct(ALERT)}를 넘음
                  <br />
                  또는 서로 다른 묶음의 지표 2개가 상위 {pct(WARN)}를 넘음
                </td>
              </tr>
              <tr>
                <td className="nowrap">
                  <span className="badge sm alert">{VERDICT_LABEL.alert}</span>
                </td>
                <td>
                  상위 {pct(ALERT)}를 넘은 지표가 있고, 서로 다른 묶음의 지표 2개가 상위 {pct(PAIR)}를 넘음
                  <br />
                  또는 지표 하나가 상위 {pct(ALERT)} 값을 크게 넘음
                </td>
              </tr>
              <tr>
                <td className="nowrap">
                  <span className="badge sm none">{VERDICT_LABEL.none}</span>
                </td>
                <td>
                  레이드나 매치가 {MIN_N}회 미만
                  <br />
                  또는 비슷한 계정이 {MIN_PEERS}명 미만
                </td>
              </tr>
              <tr>
                <td className="nowrap">
                  <span className="chip official">공인 계정</span>
                </td>
                <td>계정 등급이 Sherpa, Emissary, Developer, 채팅 관리자</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="doc-note">
          &quot;크게 넘음&quot;은 상위 {pct(ALERT)} 값에 상위 {pct(WARN)}와 {pct(ALERT)} 값의 차이를 더한 값보다 높다는 뜻입니다.
        </p>

        <h2>아레나 계정 배지</h2>
        <p>아레나는 {MIN_N}매치 이상 플레이한 모드마다 따로 판정한 뒤 결과를 합칩니다.</p>
        <div className="doc-table">
          <table>
            <thead>
              <tr>
                <th scope="col" className="badge-col">
                  배지
                </th>
                <th scope="col">조건</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="nowrap">
                  <span className="badge sm warn">{VERDICT_LABEL.warn}</span>
                </td>
                <td>
                  {VERDICT_LABEL.alert}인 모드가 있음
                  <br />
                  또는 판정한 모드의 절반 넘게 {VERDICT_LABEL.warn} 이상
                </td>
              </tr>
              <tr>
                <td className="nowrap">
                  <span className="badge sm alert">{VERDICT_LABEL.alert}</span>
                </td>
                <td>
                  {VERDICT_LABEL.alert}인 모드가 있고, 나머지 모드도 모두 {VERDICT_LABEL.warn} 이상
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>배지별 계정 비율</h2>
        <p>비교군 계정 100명 가운데 배지마다 몇 명인지 한 칸에 한 명씩 표시합니다.</p>
        <Rates rates={rates} />
        <p className="doc-note">
          이 비율은 {day.format(rates.at)} 비교군 계정 전체에 이 기준을 적용한 결과이며, 하루 한 번 다시 계산합니다.
          <br />
          {VERDICT_LABEL.none}인 계정은 빼고 셌습니다.
        </p>

        <h2>지표</h2>
        <div className="doc-table">
          <table>
            <thead>
              <tr>
                <th scope="col">모드</th>
                <th scope="col">묶음</th>
                <th scope="col">지표</th>
              </tr>
            </thead>
            <tbody>
              {MODES.flatMap(({ kind, label, families }) =>
                Object.entries(families).map(([family, name], i, all) => (
                  <tr key={`${kind}-${family}`}>
                    {i === 0 && (
                      <td className="nowrap" rowSpan={all.length}>
                        {label}
                      </td>
                    )}
                    <td className="nowrap">{name}</td>
                    <td>
                      {METRICS[kind]
                        .filter((m) => m.family === family)
                        .map((m) => (SMOOTHED.has(m.key) ? `${m.label}*` : m.label))
                        .join(", ")}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="doc-note">
          같은 묶음의 지표는 같은 기록으로 계산해 함께 오르내리므로 하나로 셉니다.
          <br />
          계정 화면의 상위 N%는 비교군에서 그 계정보다 값이 높은 계정의 비율이고, 중앙값보다 낮으면 하위 N%로 표시합니다.
          <br />* 표시 지표는 비교군 평균 기록 {PRIOR}판을 더한 보정값으로 비교해, 판수가 적은 계정이 몇 판의 운으로 높게 판정되지 않게 합니다.
        </p>

        <h2>비교군과 데이터</h2>
        <p>
          시즌, PvP, PvE는 레이드 수와 플레이 시간이, 아레나는 같은 모드의 매치 수가 ±{Math.round(WIDTHS[0] * 100)}% 안인 계정과 비교합니다.
          <br />
          비슷한 계정이 {TARGET_PEERS}명보다 적으면 ±{Math.round(WIDTHS[WIDTHS.length - 1] * 100)}%까지 범위를 넓힙니다.
          <br />
          전적과 비교군은 모두 tarkov.dev가 공개하는 기록이며, 누군가 tarkov.dev에서 그 계정을 열 때만 갱신됩니다.
          <br />
          비교군에는 tarkov.dev에서 조회된 적 있는 계정만 포함되므로 전체 이용자를 대표하지는 않습니다.
          <br />
          계정 정지 여부는 공개 기록에 없어서, 정지된 계정도 비교군에 포함될 수 있습니다.
          <br />
          계산 방식은 tarkovstats.online이 공개한 방식을 참고했습니다.
        </p>
        <p className="doc-note">
          지금 비교군 계정 수는 시즌 {int(counts.season ?? 0)}, PvP {int(counts.pvp ?? 0)}, PvE {int(counts.pve ?? 0)}, 아레나 {int(counts.arena ?? 0)}입니다.
        </p>
      </main>
      <Footer />
    </>
  );
}
