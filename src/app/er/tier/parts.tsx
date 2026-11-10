import { WEAPON_SPRITE } from "@/er/lib/tier";

/** public/img/er/weapons.v2.png에서 무기 아이콘 한 칸을 글자색으로 칠함 */
export function Weapon({ code, label }: { code: number; label?: string }) {
  const i = WEAPON_SPRITE.indexOf(code);
  if (i < 0) return null;
  return <span className="tier-wg" style={{ ["--i" as string]: i }} role={label ? "img" : undefined} aria-label={label} title={label} aria-hidden={label ? undefined : true} />;
}

/** 스프라이트에 아직 없는 새 무기는 아이콘 대신 이름 앞에 글자로 적음 */
export function WeaponText({ code, label }: { code: number; label: string }) {
  return WEAPON_SPRITE.includes(code) ? null : <span className="tier-wn">{label} </span>;
}
