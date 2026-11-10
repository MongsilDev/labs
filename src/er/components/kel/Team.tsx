import Link from "next/link";
import { LOGO_CDN, playerPath, teamPath, type KelTeam } from "@/er/lib/kel";

export const plate = (team: KelTeam) => (team.dark ? "#1d2431" : "#e9edf3");
export const logoUrl = (team: KelTeam) => `${LOGO_CDN}/${team.key}.png`;

export function Logo({ team, size = 24, label = false, className = "" }: { team: KelTeam; size?: number; label?: boolean; className?: string }) {
  return (
    <span className={`kel-logo inline-grid flex-none place-items-center rounded-[5px] p-[2px] ${className}`} style={{ width: size, height: size, background: plate(team) }} title={team.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="size-full object-contain" src={logoUrl(team)} alt={label ? team.name : ""} width={size} height={size} loading="lazy" />
    </span>
  );
}

export function TeamName({ team, size = 24, short = false }: { team: KelTeam; size?: number; short?: boolean }) {
  // 약칭은 로고 아래에 두어 칸 폭을 로고 폭에 맞춤
  if (short)
    return (
      <Link className="inline-flex flex-col items-center gap-0.5 text-[10px] leading-none text-fg-2 no-underline" href={teamPath(team)} aria-label={team.name}>
        <Logo team={team} size={size} />
        {team.short}
      </Link>
    );
  return (
    <span className="inline-flex min-w-0 items-center gap-2 max-[760px]:gap-1.5">
      <Logo team={team} size={size} />
      <Link className="truncate decoration-line-strong underline-offset-[3px] hover:decoration-fg-3" href={teamPath(team)}>
        {team.name}
      </Link>
    </span>
  );
}

export function PlayerName({ name, team, logoClass }: { name: string; team?: KelTeam; logoClass?: string }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {team && <Logo team={team} size={22} label className={logoClass} />}
      <Link className="truncate font-semibold decoration-line-strong underline-offset-[3px] hover:decoration-fg-3" href={playerPath(name)}>
        {name}
      </Link>
    </span>
  );
}
