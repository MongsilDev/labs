export type RenameGame = { nickname?: string | null; t: number };
export type RenameStep = { old: string; new: string; oldLast: number; newFirst: number };
export function renameSteps(games: RenameGame[], last?: RenameGame | null): { steps: RenameStep[]; last: RenameGame | null };
