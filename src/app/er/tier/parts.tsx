import { WEAPON_SPRITE } from "@/er/lib/tier";

/** public/img/er/weapons.v1.png에서 무기 아이콘 한 칸을 글자색으로 칠함 */
export function Weapon({ code, label }: { code: number; label?: string }) {
  const i = WEAPON_SPRITE.indexOf(code);
  if (i < 0) return null;
  return <span className="tier-wg" style={{ ["--i" as string]: i }} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
