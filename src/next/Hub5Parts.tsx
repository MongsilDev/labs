import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/er/components/kel/Team";
import { int as rp, TIERS, tens } from "@/er/lib/cut";
import { fmt } from "@/er/lib/format";
import { EVENT_NAME, TEAM } from "@/er/lib/kel";
import { comboPath, signed, type TierCombo } from "@/er/lib/tier";
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

/** 얼굴과 이름을 키운 상위 표. stats를 끄면 점수 열만 남김 */
export function TierBig({ list, stats = false }: { list: TierCombo[]; stats?: boolean }) {
  return (
    <table className="tbl tierbig">
      {/* 점수 열만 있으면 구역 제목으로 충분해 머리글은 읽어 주는 용도로만 둠 */}
      <thead className={stats ? undefined : "sr-only"}>
        <tr>
          <th className="l w-8">#</th>
          <th className="l">실험체</th>
          {stats && (
            <>
              <th className="max-sm:hidden">픽률</th>
              <th className="max-sm:hidden">승률</th>
              <th className="max-sm:hidden">TOP 3</th>
            </>
          )}
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
            {stats && (
              <>
                <td className="tb-stat max-sm:hidden">{c.pick.toFixed(2)}%</td>
                <td className="tb-stat max-sm:hidden">{c.win.toFixed(1)}%</td>
                <td className="tb-stat max-sm:hidden">{c.top3.toFixed(1)}%</td>
              </>
            )}
            <td className="tb-score">{signed(c.score)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function kelLead(h: Hub) {
  const row = h.final?.state.rows[0];
  const team = row ? TEAM.get(row.key) : undefined;
  return h.final && row && team ? { team, total: fmt(row.total), stage: `${EVENT_NAME[h.final.event]} ${h.final.stage}` } : null;
}

/** 1위 실험체 한 줄: 얼굴, 무기와 이름, 점수 */
export function TopFig({ c }: { c: TierCombo }) {
  return (
    <p className="fig">
      <Image src={face(c)} alt="" width={48} height={48} unoptimized />
      <span className="fig-t">
        <span>
          <span className="font-normal text-ink-2">{c.weaponName}</span> {c.name}
        </span>
        <b className="num">{signed(c.score)}</b>
      </span>
    </p>
  );
}

/** KEL 마지막 단계 1위 한 줄: 로고, 팀 이름, 점수 */
export function KelFig({ lead }: { lead: NonNullable<ReturnType<typeof kelLead>> }) {
  return (
    <p className="fig">
      <Logo team={lead.team} size={32} className="ring-1 ring-rule-2" />
      <span className="fig-t">
        <span>{lead.team.name}</span>
        <b className="num">{lead.total}</b>
      </span>
    </p>
  );
}
