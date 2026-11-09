import Link from "next/link";
import { int } from "@/er/lib/cut";
import { comboPath, halfArt, METRIC_LABELS, signed, tacIcon, traitIcon, type TierCombo, type TierItem, type TierMetric, type TierRouteInfo, type TierSplit, type TierView } from "@/er/lib/tier";
import RouteTable, { Rp } from "./RouteTable";
import { Weapon } from "./parts";

type Props = {
  /** 이름과 그림에 쓰는 조합. 고른 탭에 없으면 다른 탭의 값 */
  who: TierCombo;
  c?: TierCombo;
  view: TierView;
  views: TierView[];
  fallback: string;
  routes?: Record<string, TierRouteInfo>;
  items?: Record<string, TierItem>;
  thin: number;
  few?: number;
};

const metricText = (v: number, i: number) => (i === 3 ? int(Math.round(v)) : v.toFixed(i === 4 ? 1 : 2));

function Split({ title, icon, list, dn }: { title: string; icon: (code?: number) => string | null; list: TierSplit[]; dn: number }) {
  if (!list.length) return null;
  return (
    <section className="tdx-sec" aria-label={title}>
      <h2>{title}</h2>
      <table className="tdx-tb">
        <thead>
          <tr>
            <th scope="col" className="l">
              <span className="sr-only">이름</span>
            </th>
            <th scope="col" className="p">
              플레이어
            </th>
            <th scope="col" className="n">
              판 수
            </th>
            <th scope="col" className="r">
              비율
            </th>
            <th scope="col" className="g">
              RP 획득
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map(([name, players, n, g, code], i) => {
            const src = icon(code);
            return (
              <tr key={`${name}:${i}`}>
                <td className="l">
                  <span className="tdx-name">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {src ? <img className="tdx-ic" src={src} alt="" width={28} height={28} loading="lazy" /> : <span className="tdx-ic" aria-hidden="true" />}
                    {name}
                  </span>
                </td>
                <td className="p">{int(players)}명</td>
                <td className="n">{int(n)}</td>
                <td className="r">{((n / dn) * 100).toFixed(1)}%</td>
                <Rp g={g} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function Metric({ name, m, base }: { name: string; m?: TierMetric; base?: TierMetric }) {
  if (!m) return null;
  return (
    <section className="tdx-sec" aria-label="경기 지표">
      <h2>
        경기 지표<small>판당 평균</small>
      </h2>
      <table className="tdx-tb tdx-mt">
        <thead>
          <tr>
            <th scope="col" className="l">
              <span className="sr-only">지표</span>
            </th>
            <th scope="col">{name}</th>
            {base && <th scope="col">상위 1,000명</th>}
          </tr>
        </thead>
        <tbody>
          {METRIC_LABELS.map((label, i) => (
            <tr key={label}>
              <th scope="row" className="l">
                {label}
              </th>
              <td>{metricText(m[i], i)}</td>
              {base && <td className="tdx-base">{metricText(base[i], i)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default function TierDetail({ who, c, view, views, fallback, routes, items, thin, few }: Props) {
  const dn = c?.dn ?? 0;
  const art = halfArt(who.key);
  const range = c?.half != null ? `${signed(c.score - c.half)} ~ ${signed(c.score + c.half)}` : null;
  const isThin = !!c && (c.n < thin || (few != null && c.ep != null && c.ep < few));
  return (
    <>
      <section className="tdx-hero" data-grade={c?.grade}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {art && <img className="tdx-art" src={art} alt="" width={390} height={576} fetchPriority="high" />}
        <div className="tdx-id">
          <h1>
            <span className="tdx-wn">
              <Weapon code={who.weapon} />
              {who.weaponName}
            </span>
            <span className="tdx-nm">{who.name}</span>
          </h1>
          {c && (
            <span className="tier-grade tdx-grade" data-grade={c.grade} aria-label={`${c.grade} 등급`}>
              {c.grade}
            </span>
          )}
          {!!who.roles?.length && <p className="tdx-roles">{who.roles.join(", ")}</p>}
        </div>
        {c && (
          <dl className="tdx-stats">
            <div className="tdx-score">
              <dt>점수</dt>
              <dd>
                {signed(c.score)}
                {range && (
                  <small>
                    90% 범위 <span className="tdx-nw">{range}</span>
                  </small>
                )}
              </dd>
            </div>
            <div>
              <dt>판 수</dt>
              <dd>
                {int(c.n)}
                <small>플레이어 {int(c.players)}명</small>
              </dd>
            </div>
            <div>
              <dt>평균 순위</dt>
              <dd>{c.place.toFixed(2)}</dd>
            </div>
            <div>
              <dt>TOP 3</dt>
              <dd>{c.top3.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>승률</dt>
              <dd>{c.win.toFixed(1)}%</dd>
            </div>
            <div>
              <dt>픽률</dt>
              <dd>{c.pick.toFixed(2)}%</dd>
            </div>
          </dl>
        )}
        {isThin && (
          <p className="tdx-thin" role="note">
            판 수가 적어 점수가 크게 바뀔 수 있습니다.
          </p>
        )}
      </section>

      <nav className="tabs tdx-tabs" aria-label="기간">
        {views.map((v) => (
          <Link key={v.id} href={comboPath(who, v.id === fallback ? null : v.id)} replace scroll={false} aria-current={v.id === view.id ? "page" : undefined}>
            {v.season ? `${v.season} ${v.label}` : v.label}
          </Link>
        ))}
      </nav>

      {!c ? (
        <p className="tdx-empty" role="status">
          {view.season ? `${view.season} ${view.label}` : view.label}에는 기록이 없습니다.
          <br />
          다른 기간을 골라 주세요.
        </p>
      ) : !dn ? (
        <p className="tdx-empty" role="status">
          상위 1,000명이 직접 플레이한 판이 없어 루트와 특성 기록이 없습니다.
        </p>
      ) : (
        <>
          {!!c.routes?.length && (
            <section className="tdx-sec" aria-label="루트">
              <h2>
                루트<small>상위 1,000명의 {int(dn)}판</small>
              </h2>
              <RouteTable list={c.routes} info={routes} items={items} dn={dn} patch={view.patch} />
            </section>
          )}
          <div className="tdx-cols">
            <Split title="핵심 특성" icon={traitIcon} list={c.traits ?? []} dn={dn} />
            <Split title="전술 스킬" icon={tacIcon} list={c.tac ?? []} dn={dn} />
            <Metric name={who.name} m={c.metric} base={view.metric} />
          </div>
        </>
      )}
    </>
  );
}
