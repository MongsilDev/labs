import Link from "next/link";
import Char from "@/er/components/t/Char";
import { int } from "@/er/lib/cut";
import { TEAM } from "@/er/lib/kel";
import type { KelRow } from "@/er/server/kel";
import { gameLabel, type Records } from "@/er/server/kel-stats";

type Tile = { label: string; row: (x: Records) => KelRow | null; value: (r: KelRow) => React.ReactNode; unit?: string };

// 첫 화면과 한 게임 기록이 같이 쓰는 칸
const TILES = {
  kills: { label: "최다 킬", row: (x) => x.kills, value: (r) => r.kills, unit: "킬" },
  damage: { label: "최다 가한 피해", row: (x) => x.damage[0]?.r ?? null, value: (r) => int(r.damage) },
  taken: { label: "최다 받은 피해", row: (x) => x.taken, value: (r) => int(r.taken) },
  lowTeamDamage: { label: "7위 이하 팀의 최다 가한 피해", row: (x) => x.lowTeamDamage, value: (r) => int(r.damage) },
  cc: { label: "최다 군중제어 시간", row: (x) => x.cc, value: (r) => r.dak!.cc.toFixed(1), unit: "초" },
  heal: { label: "최다 팀원 회복", row: (x) => x.heal, value: (r) => int(r.dak!.heal) },
  camera: { label: "최다 망원\u00a0카메라 설치", row: (x) => x.camera, value: (r) => r.dak!.camera, unit: "개" },
  vision: { label: "최다 시야 점수", row: (x) => x.vision, value: (r) => r.dak!.vision },
} satisfies Record<string, Tile>;

function Who({ r }: { r: KelRow }) {
  return (
    <div className="mt-1 grid gap-1">
      <p className="text-[15px] font-bold">
        <Char name={r.character} label={r.player} />
      </p>
      <p className="text-[13px] leading-relaxed text-fg-3">
        {TEAM.get(r.team)!.name}
        <br />
        {gameLabel(r)}
      </p>
    </div>
  );
}

// 칸 전체가 링크일 수 있어 안쪽에는 링크를 두지 않음
export function Best({ label, value, unit, href, r, className = "", children }: { label: string; value: React.ReactNode; unit?: string; href?: string; r?: KelRow; className?: string; children?: React.ReactNode }) {
  const body = (
    <>
      <p className="text-[13px] text-fg-3">{label}</p>
      <p className="text-[28px] leading-none font-extrabold tabular-nums max-[760px]:text-[24px]">
        {value}
        {unit && <span className="ml-0.5 text-[16px]">{unit}</span>}
      </p>
      {r && <Who r={r} />}
      {children}
    </>
  );
  const box = `panel grid content-start gap-2 p-5 max-[760px]:p-4 ${className}`;
  return href ? (
    <Link className={`${box} no-underline hover:border-line-strong`} href={href}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export function Bests({ rec, keys, prefix = "", href }: { rec: Records; keys: (keyof typeof TILES)[]; prefix?: string; href: (r: KelRow) => string }) {
  return keys.map((k) => {
    const t: Tile = TILES[k];
    const r = t.row(rec);
    return r && <Best key={k} label={prefix + t.label} value={t.value(r)} unit={t.unit} href={href(r)} r={r} />;
  });
}
