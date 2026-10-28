import Link from "next/link";
import { LOGO_CDN, playerPath, teamPath, type KelTeam } from "@/er/lib/kel";

export const plate = (team: KelTeam) => (team.dark ? "#1d2431" : "#e9edf3");
export const logoUrl = (team: KelTeam) => `${LOGO_CDN}/${team.key}.png`;

export function Logo({ team, size = 24, label = false, className = "" }: { team: KelTeam; size?: number; label?: boolean; className?: string }) {
  return (
    <span className={`inline-grid flex-none place-items-center rounded-[5px] p-[2px] ${className}`} style={{ width: size, height: size, background: plate(team) }} title={team.name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="size-full object-contain" src={logoUrl(team)} alt={label ? team.name : ""} width={size} height={size} loading="lazy" />
    </span>
  );
}

export function TeamName({ team, size = 24 }: { team: KelTeam; size?: number }) {
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
