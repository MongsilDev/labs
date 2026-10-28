import type { MetadataRoute } from "next";
import { KEL_SCREENS, KEL_TEAMS, playerPath, teamPath } from "@/er/lib/kel";
import { BASE_URL } from "@/er/server/auth";
import { kelData } from "@/er/server/kel";
import { playerStats } from "@/er/server/kel-stats";

export const dynamic = "force-dynamic";

const PATHS = [
  "",
  "/privacy",
  "/terms",
  "/er/score",
  "/er/cut",
  "/er/example/a",
  "/tarkov/players",
  "/tarkov/kord-breach",
  "/tarkov/criteria",
  ...Object.values(KEL_SCREENS)
    .filter((s) => s.public)
    .map((s) => s.path),
  `${KEL_SCREENS.characters.path}?view=build`,
];

export default function sitemap(): MetadataRoute.Sitemap {
  const data = kelData();
  const kel = [...(KEL_SCREENS.teams.public ? KEL_TEAMS.map(teamPath) : []), ...(data && KEL_SCREENS.players.public ? playerStats(data).map((p) => playerPath(p.name)) : [])];
  return [...PATHS, ...kel].map((path) => ({ url: `${BASE_URL}${path}` }));
}
