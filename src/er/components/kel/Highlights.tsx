import Link from "next/link";
import { Logo } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { int } from "@/er/lib/cut";
import { characterName, pct } from "@/er/lib/format";
import { KEL_SCREENS, playerPath, TEAM } from "@/er/lib/kel";
import type { highlights } from "@/er/server/kel-stats";

type Data = ReturnType<typeof highlights>;

const line = "border-t border-line-soft py-2 first:border-t-0 first:pt-0";
const row = "grid min-h-[36px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3";
const go = "no-underline hover:text-fg";

function Head({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className={`mb-2 inline-flex items-center gap-0.5 text-[13px] text-fg-3 ${go}`} href={href}>
      {children}
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

// 좁은 화면에서는 실험체와 조합을 첫 줄만 두 칸으로 나란히 두어 옆 카드와 높이를 맞춤
const first = "max-[760px]:[&>li:nth-child(n+2)]:hidden";
const narrow = "max-[760px]:hidden";
// 좁은 화면의 최고 기록은 세 칸으로 나누고 칸 안에서 초상, 값, 선수 순서로 쌓음
const stack = "max-[760px]:grid-cols-1 max-[760px]:content-start max-[760px]:gap-1.5 max-[760px]:border-t-0 max-[760px]:py-0";

export default function Highlights({ data }: { data: Data }) {
  const { characters, records, comps } = KEL_SCREENS;
  return (
    <div className="grid grid-cols-3 gap-x-8 gap-y-5 max-[1080px]:gap-x-6 max-[760px]:grid-cols-2 max-[760px]:gap-x-4">
      {data.characters.length > 0 && (
        <section className="min-w-0" aria-label="많이 등장한 실험체">
          <Head href={characters.path}>많이 등장한 실험체</Head>
          <ul className={`grid ${first}`}>
            {data.characters.map((c) => (
              <li key={c.key} className={line}>
                <Link className={`${row} ${go} max-[760px]:gap-2`} href={characters.path}>
                  <Char name={c.key} label="" size={36} />
                  <span className="grid min-w-0 gap-1">
                    <span className="truncate text-[14px] font-bold">{characterName(c.key)}</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-field">
                      <span className="block h-full rounded-full" style={{ width: `${c.rate * 100}%`, background: "var(--kel-1)" }} />
                    </span>
                  </span>
                  <span className="grid justify-items-end">
                    <span className="text-[16px] leading-tight font-extrabold tabular-nums">{pct(c.rate)}</span>
                    <span className={`text-[12px] text-fg-3 tabular-nums ${narrow}`}>{c.games}게임</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.bests.length > 0 && (
        <section className="min-w-0 max-[760px]:order-last max-[760px]:col-span-2" aria-label="한 게임 최고 기록">
          <Head href={records.path}>한 게임 최고 기록</Head>
          <ul className="grid max-[760px]:grid-cols-3 max-[760px]:gap-x-3">
            {data.bests.map((b) => {
              const team = TEAM.get(b.r.team);
              return (
                <li key={b.key} className={`${line} ${row} ${stack}`}>
                  <Link className="flex" href={records.path} aria-label={`${b.label} ${characterName(b.r.character)}`}>
                    <Char name={b.r.character} label="" size={36} />
                  </Link>
                  <span className="flex min-w-0 items-center gap-1.5 max-[760px]:order-last">
                    {team && <Logo team={team} size={20} label />}
                    <Link className={`truncate text-[14px] font-bold ${go}`} href={playerPath(b.r.player)}>
                      {b.r.player}
                    </Link>
                  </span>
                  <Link className={`grid justify-items-end ${go} max-[760px]:justify-items-start`} href={records.path}>
                    <span className="text-[16px] leading-tight font-extrabold tabular-nums">{int(b.value)}</span>
                    <span className="text-[12px] text-fg-3">{b.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {data.comps.length > 0 && (
        <section className="min-w-0" aria-label="많이 등장한 3인 조합">
          <Head href={comps.path}>많이 등장한 3인 조합</Head>
          <ul className={`grid ${first}`}>
            {data.comps.map((c) => {
              const names = c.characters.map(characterName).join(", ");
              return (
                <li key={c.characters.join("|")} className={line}>
                  <Link className={`${row} ${go} max-[760px]:gap-2`} href={comps.path}>
                    <span className="flex" role="img" aria-label={names}>
                      {c.characters.map((k) => (
                        <span key={k} className="-ml-2 flex rounded-full border-2 border-surface first:ml-0">
                          <Char name={k} label="" size={32} />
                        </span>
                      ))}
                    </span>
                    <span className={`truncate text-[13px] text-fg-2 ${narrow}`} aria-hidden="true">
                      {names}
                    </span>
                    <span className="text-[16px] font-extrabold whitespace-nowrap tabular-nums">{c.count}번</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
