import { WEAPON_SPRITE } from "@/er/lib/tier";

// 스프라이트에 아직 없는 새 무기는 아이콘 대신 글자로 적음
export default function Weapon({ code, name }: { code: number; name: string }) {
  const i = WEAPON_SPRITE.indexOf(code);
  if (i < 0) return <span className="text-ink-3">{name}</span>;
  return <span className="wg" style={{ ["--i" as string]: i }} role="img" aria-label={name} title={name} />;
}
