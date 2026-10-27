import { barTotal, type Standing } from "@/er/lib/engine";
import { fmt, num, rampColor, rampTextClass } from "@/er/lib/format";

export default function Bar({ s, max, rounds, height = 16, labels = true }: { s: Standing; max: number; rounds: number; height?: number; labels?: boolean }) {
  const scale = max > 0 ? 100 / max : 0;
  return (
    <div className="bar" style={{ height }} aria-hidden="true">
      {s.rounds.map((r, i) =>
        r && r.score > 0 ? (
          <s key={i} className={rampTextClass(i, rounds)} style={{ width: `${r.score * scale}%`, background: rampColor(i, rounds) }} title={`${i + 1}라운드 ${num(r.score)}점`}>
            {labels && r.score * scale > 9 ? num(r.score) : ""}
          </s>
        ) : null,
      )}
      {s.penalty > 0 && barTotal(s) > 0 && (
        <i
          className="pen"
          style={{ left: `${Math.max(0, barTotal(s) - s.penalty) * scale}%`, width: `${Math.min(s.penalty, barTotal(s)) * scale}%` }}
          title={`감점 ${fmt(s.penalty)}점`}
        />
      )}
    </div>
  );
}

export function Legend({ rounds, advance }: { rounds: number; advance: number }) {
  return (
    <span className="legend">
      {advance > 0 && (
        <span>
          <i style={{ background: "var(--accent)", height: 3 }} />
          상위 {advance}팀 진출
        </span>
      )}
      {rounds > 4 ? (
        <span>
          1R
          <i className="ramp" style={{ background: `linear-gradient(90deg, ${rampColor(0, rounds)}, ${rampColor(rounds - 1, rounds)})` }} />
          {rounds}R
        </span>
      ) : (
        Array.from({ length: rounds }, (_, i) => (
          <span key={i}>
            <i style={{ background: rampColor(i, rounds) }} />
            {i + 1}R
          </span>
        ))
      )}
    </span>
  );
}
