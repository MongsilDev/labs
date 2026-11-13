export class Pace {
  constructor(rps: number);
  rps: number;
  set(rps: number): void;
  take(): Promise<void>;
  limited(waitMs: number): void;
}
export function botLast429(): number | null;
