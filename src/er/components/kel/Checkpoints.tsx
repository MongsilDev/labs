import { CHECKPOINT_SEQUENCE } from "@/er/lib/rules";

export default function Checkpoints() {
  return (
    <ol className="mt-3 grid grid-cols-5 gap-2" aria-label="라운드별 체크포인트 팀 수">
      {CHECKPOINT_SEQUENCE.map((n, i) =>
        n > 0 ? (
          <li key={i} className="grid justify-items-center gap-1.5 text-center">
            <span className="grid grid-cols-4 gap-[3px]" aria-hidden="true">
              {Array.from({ length: 8 }, (_, k) => (
                <span key={k} className={`size-[9px] rounded-full ${k < n ? "bg-accent" : "bg-line"}`} />
              ))}
            </span>
            <span className="text-[12px] text-fg-3">
              {i + 1}R {n >= 8 ? "모든 팀" : `${n}팀`}
            </span>
          </li>
        ) : null,
      )}
    </ol>
  );
}
