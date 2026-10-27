import Link from "next/link";
import Lines from "@/components/Lines";
import { Best, Bests } from "@/er/components/kel/Best";
import KelPage from "@/er/components/kel/KelPage";
import { Logo, TeamName } from "@/er/components/kel/Team";
import { championshipTeams, KEL_SCREENS, KEL_SECTIONS, kelVisible, TEAM, type KelTeam } from "@/er/lib/kel";
import { kelData, kelGate, kelMetadata, kelSummary } from "@/er/server/kel";
import { records, wicklines } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";
export const generateMetadata = () => kelMetadata("home");

const day = (date: string) => {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
};

function Event({ date, name, teams, slot, text }: { date: string; name: string; teams: KelTeam[]; slot?: string; text: string }) {
  return (
    <section className="panel grid content-start gap-3 p-5 max-[760px]:p-4" aria-label={name}>
      <div>
        <p className="text-[13px] text-fg-3">{date}</p>
        <h2 className="text-[22px] font-extrabold tracking-[-0.3px]">{name}</h2>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
        {teams.map((t) => (
          <li key={t.key} className="min-w-0">
            <TeamName team={t} size={28} />
          </li>
        ))}
        {slot && <li className="col-span-2 flex min-h-16 items-center rounded-md border border-dashed border-line-strong px-3 text-fg-3">{slot}</li>}
      </ul>
      <p className="text-[14px] text-fg-2">
        <Lines text={text} />
      </p>
    </section>
  );
}

export default async function Page() {
  const { user, owner } = await kelGate("home");
  const data = kelData();
  const summary = data ? kelSummary(data) : null;
  const rec = data && records(data);
  const wicks = data ? wicklines(data) : [];
  const wick = wicks[0];
  const wickTeam = wick && TEAM.get(wick.team)!;
  const { seeds, semi } = championshipTeams();
  const lead = summary?.first && summary.last ? `${day(summary.first)} 오프닝 위크부터 ${day(summary.last)} 서킷 4 결승까지 열린 ${summary.games}게임의 기록입니다.` : undefined;

  return (
    <KelPage user={user} owner={owner} screen="home" lead={lead}>
      <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
        <Event date="11월 7일 토요일, 대전이스포츠경기장" name="준결승" teams={semi} text="준결승에는 정규 시즌 5~12위 8팀이 출전해 6라운드를 진행합니다. 상위 4팀이 결승에 진출합니다." />
        <Event
          date="11월 8일 일요일, 대전이스포츠경기장"
          name="결승"
          teams={seeds}
          slot="준결승 상위 4팀"
          text={"정규 시즌 1~4위는 결승에 직행했습니다. 결승은 순차 체크포인트 방식으로 최대\u00a09라운드까지 진행합니다."}
        />
      </div>
      {rec && (
        <section aria-labelledby="best">
          <h2 id="best" className="text-[17px] font-extrabold">
            시즌 최고 기록
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3 max-[760px]:grid-cols-2">
            <Bests rec={rec} keys={["kills", "damage", "cc", "heal", "camera"]} prefix="한 게임 " href={() => KEL_SCREENS.records.path} />
            {wick && wickTeam && (
              <Best label="위클라인 최다 처치" value={wick.count} unit="게임" href={`${KEL_SCREENS.teams.path}?v=ops`}>
                {/* 카드가 좁아 전체 이름이 잘리는 폭에서는 제목과 아래 줄 모두 지역명으로 */}
                <div className="@container mt-1 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1">
                  <div className="flex items-center gap-2">
                    <Logo team={wickTeam} size={34} />
                    <p className="grid min-w-0 leading-snug">
                      <span className="truncate text-[15px] font-bold">
                        <span className="@max-[136px]:hidden">{wickTeam.name}</span>
                        <span className="hidden @max-[136px]:inline">{wickTeam.short}</span>
                      </span>
                      <span className="truncate text-[13px] text-fg-3">{wick.games}게임 가운데</span>
                    </p>
                  </div>
                  <p className="text-[13px] leading-relaxed text-fg-3">
                    {wicks.slice(1, 3).map((w) => (
                      <span key={w.team} className="block truncate">
                        {1 + wicks.filter((x) => x.count > w.count).length}위 <span className="@max-[136px]:hidden">{TEAM.get(w.team)!.name}</span>
                        <span className="hidden @max-[136px]:inline">{TEAM.get(w.team)!.short}</span> {w.count}게임
                      </span>
                    ))}
                  </p>
                </div>
              </Best>
            )}
          </div>
        </section>
      )}
      <nav className="panel grid grid-cols-2 gap-x-8 px-5 py-2 max-[1080px]:grid-cols-1 max-[760px]:px-4" aria-label="KEL 화면">
        {KEL_SECTIONS.map((s) => {
          const items = s.items.filter((key) => kelVisible(key, owner));
          if (!items.length) return null;
          return (
            <div key={s.title} className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-x-5 gap-y-1.5 border-t border-line-soft py-3 min-[1081px]:[&:nth-child(-n+2)]:border-t-0 max-[1080px]:first:border-t-0 max-[760px]:grid-cols-1">
              <h2 className="text-[14px] font-semibold text-fg-3">{s.title}</h2>
              <ul className="flex flex-wrap gap-x-6 gap-y-1.5">
                {items.map((key) => (
                  <li key={key}>
                    <Link className="font-bold decoration-line-strong underline-offset-[3px] hover:decoration-fg-3" href={KEL_SCREENS[key].path}>
                      {KEL_SCREENS[key].title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </KelPage>
  );
}
