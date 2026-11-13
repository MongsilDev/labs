import type { PreData } from "../../../src/next/preseason";

type Names = {
  char: (code: number) => { key: string; name: string };
  weapon: (code: number) => string;
  skill: (code: number) => string;
  state: (code: number) => string;
  weather: (code: number) => string;
  item: (code: number) => [string, string | null];
};
export function derivePre(rows: Iterable<Record<string, unknown>>, season: { id: number; name: string; start?: number }, nm: Names, scan?: PreData["scan"], baseRows?: Iterable<Record<string, unknown>>): PreData | null;
export function writePre(root: string, data: PreData | null): boolean;
