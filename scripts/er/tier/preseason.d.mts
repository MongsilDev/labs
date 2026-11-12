import type { PreData } from "../../../src/next/preseason";

type Names = {
  char: (code: number) => { key: string; name: string };
  weapon: (code: number) => string;
  skill: (code: number) => string;
  state: (code: number) => string;
  weather: (code: number) => string;
};
export function derivePre(rows: Iterable<Record<string, unknown>>, season: { id: number; name: string }, nm: Names, scan?: PreData["scan"]): PreData | null;
export function writePre(root: string, data: PreData | null): boolean;
