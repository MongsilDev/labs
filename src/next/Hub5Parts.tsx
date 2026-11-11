import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/er/components/kel/Team";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { fmt1 } from "@/er/lib/format";
import { TEAM } from "@/er/lib/kel";
import { comboPath, signed, type TierCombo } from "@/er/lib/tier";
import HubSearch from "@/tarkov/components/players/HubSearch";
import { face, n } from "./HubParts";
import type { Hub } from "./hub";

export function Chev({ className = "" }: { className?: string }) {
  return (
    <svg className={`size-4 flex-none ${className}`} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** 컷 숫자 두 개. 글자 크기와 배치는 감싼 쪽이 --cut-size와 .cutnums 규칙으로 정함 */
export function CutNums({ cut, forecast = true }: { cut: NonNullable<Hub["cut"]>; forecast?: boolean }) {
  return (
    <dl className="cutnums">
      {TIERS.map(({ key, name, color }) => {
        const t = cut.tiers[key];
        const end = t.forecast?.[t.forecast.length - 1];
        return (
          <div key={key}>
            <dt className="num">
              <span style={{ background: color }} aria-hidden="true" />
              {name} {n(t.place)}위
            </dt>
            <dd className="num">
              {t.estimated ? <small>약</small> : null}
              {t.cut != null ? rp(t.cut) : "-"}
            </dd>
            {forecast && end && <p className="num">종료 예상 {tens(end[1])}</p>}
          </div>
        );
      })}
    </dl>
  );
}

/** 얼굴과 이름을 키운 상위 표 */
export function TierBig({ list }: { list: TierCombo[] }) {
  return (
    <table className="tbl tierbig">
      {/* 점수 열만 있으면 구역 제목으로 충분해 머리글은 읽어 주는 용도로만 둠 */}
      <thead className="sr-only">
        <tr>
          <th className="l w-8">#</th>
          <th className="l">실험체</th>
          <th>점수</th>
        </tr>
      </thead>
      <tbody>
        {list.map((c, i) => (
          <tr key={`${c.char}-${c.weapon}`}>
            <td className="l text-ink-3">{i + 1}</td>
            <td className="l">
              <Link href={comboPath(c)} className="tb-who">
                <Image className="tb-face" src={face(c)} alt="" width={56} height={56} unoptimized />
                {/* 같은 실험체가 무기만 달리 함께 오르기도 해서 무기 이름을 글자로 씀 */}
                <span className="tb-name">
                  <span>{c.weaponName}</span>
                  <b>{c.name}</b>
                </span>
              </Link>
            </td>
            <td className="tb-score">{signed(c.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 실험체 표와 같은 줄 높이와 글자 크기로 그린 KEL 마지막 단계 순위 */
export function KelBig({ h, rows = 4 }: { h: Hub; rows?: number }) {
  if (!h.final) return <p className="py-3 text-ink-3">KEL 기록을 불러오지 못했습니다.</p>;
  return (
    <table className="tbl tierbig">
      <thead className="sr-only">
        <tr>
          <th className="l w-8">#</th>
          <th className="l">팀</th>
          <th>점수</th>
        </tr>
      </thead>
      <tbody>
        {h.final.state.rows.slice(0, rows).map((row, i) => {
          const t = TEAM.get(row.key)!;
          return (
            <tr key={row.key}>
              <td className="l text-ink-3">{i + 1}</td>
              <td className="l">
                <Link href="/er/kel/finals" className="tb-who">
                  <Logo team={t} size={40} className="tb-logo ring-1 ring-rule-2" />
                  <b className="tb-team">{t.name}</b>
                </Link>
              </td>
              <td className="tb-score">{fmt1(row.total)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** 닉네임만 받아 오버레이 화면으로 넘김. 위치와 이동 값은 그 화면에서 고름 */
export function OverlayOpen() {
  return (
    <form action="/er/overlay" className="mt-3">
      <label className="lbl" htmlFor="hub-ov">닉네임</label>
      <div className="grid max-w-[280px] grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input id="hub-ov" name="n" className="field" autoComplete="off" spellCheck={false} maxLength={32} />
        <button className="btn primary">주소 만들기</button>
      </div>
    </form>
  );
}

/** 타르코프는 다른 게임이라 이터널 리턴 기능과 섞지 않고 한 묶음으로 둠 */
export function TarkovGroup({ className = "" }: { className?: string }) {
  return (
    <section className={`hub-tk ${className}`}>
      <h2 className="sec-h">타르코프</h2>
      <div>
        <h3>
          <Link href="/tarkov/players">계정 조회</Link>
        </h3>
        <HubSearch />
      </div>
      <Link href="/tarkov/kord-breach">
        <b>KORD BREACH 특성 시뮬레이터</b>
        <Chev />
      </Link>
    </section>
  );
}
