import Link from "next/link";
import { go, Head, line, row } from "@/er/components/HubList";
import { Logo } from "@/er/components/kel/Team";
import Char from "@/er/components/t/Char";
import { int } from "@/er/lib/cut";
import { characterName, pct } from "@/er/lib/format";
import { KEL_SCREENS, playerPath, TEAM } from "@/er/lib/kel";
import type { highlights } from "@/er/server/kel-stats";

type Data = ReturnType<typeof highlights>;

// 1024 미만의 최고 기록은 세 칸으로 나누고 칸 안에서 초상, 값, 선수 순서로 쌓음
const stack = "max-[1024px]:grid-cols-1 max-[1024px]:content-start max-[1024px]:gap-1.5 max-[1024px]:border-t-0 max-[1024px]:py-0";

export default function Highlights({ data }: { data: Data }) {
  const { characters, records, comps } = KEL_SCREENS;
  return (
    <div className="grid grid-cols-3 gap-x-8 gap-y-5 max-[1080px]:gap-x-6 max-[1024px]:grid-cols-2 max-[760px]:grid-cols-1">
      {data.characters.length > 0 && (
        <section className="min-w-0" aria-label="많이 등장한 실험체">
          <Head href={characters.path}>많이 등장한 실험체</Head>
          <ul className="grid">
            {data.characters.map((c) => (
              <li key={c.key} className={line}>
                <Link className={`${row} ${go}`} href={characters.path}>
                  <Char name={c.key} label="" size={36} />
                  <span className="grid min-w-0 gap-1">
                    <span className="truncate text-[14px] font-bold">{characterName(c.key)}</span>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-field">
                      <span className="block h-full rounded-full" style={{ width: `${c.rate * 100}%`, background: "var(--kel-1)" }} />
                    </span>
                  </span>
                  <span className="grid justify-items-end">
                    <span className="text-[16px] leading-tight font-extrabold tabular-nums">{pct(c.rate)}</span>
                    <span className="text-[12px] text-fg-3 tabular-nums">{c.games}게임</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.bests.length > 0 && (
        <section className="min-w-0 max-[1024px]:order-last max-[1024px]:col-span-2 max-[760px]:col-span-1" aria-label={records.title}>
          <Head href={records.path}>{records.title}</Head>
          <ul className="grid max-[1024px]:grid-cols-3 max-[1024px]:gap-x-3">
            {data.bests.map((b) => {
              const team = TEAM.get(b.r.team);
              return (
                <li key={b.key} className={`${line} ${row} ${stack}`}>
                  <Link className="flex" href={records.path} aria-label={`${b.label} ${characterName(b.r.character)}`}>
                    <Char name={b.r.character} label="" size={36} />
                  </Link>
                  <span className="flex min-w-0 items-center gap-1.5 max-[1024px]:order-last">
                    {team && <Logo team={team} size={20} label />}
                    <Link className={`truncate text-[14px] font-bold ${go}`} href={playerPath(b.r.player)}>
                      {b.r.player}
                    </Link>
                  </span>
                  <Link className={`grid justify-items-end ${go} max-[1024px]:justify-items-start`} href={records.path}>
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
          <ul className="grid">
            {data.comps.map((c) => {
              const names = c.characters.map(characterName).join(", ");
              return (
                <li key={c.characters.join("|")} className={line}>
                  <Link className={`${row} ${go}`} href={comps.path}>
                    <span className="flex" role="img" aria-label={names}>
                      {c.characters.map((k) => (
                        <span key={k} className="-ml-2 flex rounded-full border-2 border-surface first:ml-0">
                          <Char name={k} label="" size={32} />
                        </span>
                      ))}
                    </span>
                    <span className="truncate text-[13px] text-fg-2" aria-hidden="true">
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
