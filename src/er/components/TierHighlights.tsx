import Link from "next/link";
import { go, Head, line, row } from "@/er/components/HubList";
import { int } from "@/er/lib/cut";
import { signed, type TierCombo, type TierMoved } from "@/er/lib/tier";
import { Weapon, WeaponText } from "@/app/er/tier/parts";

const HREF = "/er/tier";

function Combo({ c, value, sub }: { c: TierCombo; value: string; sub: string }) {
  return (
    <li className={`${line} max-[760px]:nth-3:hidden`}>
      <Link className={`${row} ${go}`} href={HREF}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="size-9 rounded-[10px] bg-field object-cover" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={36} height={36} loading="lazy" />
        <span className="tier-wi min-w-0 truncate text-[14px] font-bold">
          <Weapon code={c.weapon} label={c.weaponName} />
          <WeaponText code={c.weapon} label={c.weaponName} />
          {c.name}
        </span>
        <span className="grid justify-items-end">
          <span className="text-[16px] leading-tight font-extrabold tabular-nums">{value}</span>
          <span className="text-[12px] text-fg-3 tabular-nums">{sub}</span>
        </span>
      </Link>
    </li>
  );
}

// 점수 상위는 /er/tier에서 흐리게 보이는 표본 적은 조합을 뺌. 좁은 화면은 칸마다 두 줄
export default function TierHighlights({ combos, thin, few, moved, prev }: { combos: TierCombo[]; thin: number; few?: number; moved: TierMoved[]; prev?: string }) {
  const solid = combos.filter((c) => c.n >= thin && (few == null || c.ep == null || c.ep >= few));
  const top = [...solid].sort((a, b) => b.score - a.score).slice(0, 3);
  const picked = [...combos].sort((a, b) => b.pick - a.pick || b.n - a.n).slice(0, 3);
  const up = moved.filter((m) => m.c.score > m.o.score).slice(0, 3);
  return (
    <div className="grid grid-cols-3 gap-x-8 gap-y-5 max-[1080px]:gap-x-6 max-[760px]:grid-cols-1">
      <section className="min-w-0" aria-label="점수가 높은 실험체">
        <Head>점수가 높은 실험체</Head>
        <ul className="grid">
          {top.map((c) => (
            <Combo key={`${c.char}:${c.weapon}`} c={c} value={signed(c.score)} sub={`${int(c.n)}판`} />
          ))}
        </ul>
      </section>
      <section className="min-w-0" aria-label="픽률이 높은 실험체">
        <Head>픽률이 높은 실험체</Head>
        <ul className="grid">
          {picked.map((c) => (
            <Combo key={`${c.char}:${c.weapon}`} c={c} value={`${c.pick.toFixed(2)}%`} sub={`${int(c.n)}판`} />
          ))}
        </ul>
      </section>
      {prev && up.length > 0 && (
        <section className="min-w-0" aria-label={`${prev} 패치보다 강해진 실험체`}>
          <Head>{prev} 패치보다 강해진 실험체</Head>
          <ul className="grid">
            {up.map(({ c, o }) => (
              <Combo key={`${c.char}:${c.weapon}`} c={c} value={signed(c.score - o.score)} sub={`${signed(o.score)} → ${signed(c.score)}`} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
