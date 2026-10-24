"use client";

import { useEffect, useRef, useState } from "react";
import Lines from "@/components/Lines";

type Row = { team: string; placement: string; killScore: string };

export default function ManualRound({
  round,
  teams,
  onClose,
  onSave,
}: {
  round: number;
  teams: string[];
  onClose: () => void;
  onSave: (rows: { team: string; placement: number; killScore: number }[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    (teams.length ? teams : Array.from({ length: 8 }, () => "")).map((team) => ({ team, placement: "", killScore: "" })),
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => {
    first.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const filled = rows
      .filter((r) => r.team.trim() && r.placement)
      .map((r) => ({ team: r.team.trim(), placement: Number(r.placement), killScore: Number(r.killScore) || 0 }));
    if (filled.length === 0) return setError("팀 이름과 순위를 하나 이상 입력해주세요.");
    const places = filled.map((r) => r.placement);
    if (new Set(places).size !== places.length) return setError("두 팀에 같은 순위를 입력했습니다. 순위를 다시 확인해주세요.");
    if (filled.some((r) => (r.killScore * 2) % 1 !== 0)) return setError("킬 점수는 0.5 단위로 입력해주세요.");
    setBusy(true);
    try {
      await onSave(filled);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장하지 못했습니다.");
      setBusy(false);
    }
  };

  return (
    <div className="dim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="panel dialog max-w-[520px]" role="dialog" aria-modal="true" aria-labelledby="manual-h" onSubmit={save} noValidate>
        <h2 id="manual-h">{round}라운드 직접 입력</h2>
        <table className="manual mt-3">
          <thead>
            <tr>
              <th scope="col">팀</th>
              <th scope="col">순위</th>
              <th scope="col">킬 점수</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    ref={i === 0 ? first : undefined}
                    className="field sm"
                    aria-label={`${i + 1}번째 팀 이름`}
                    value={r.team}
                    maxLength={40}
                    autoComplete="off"
                    onChange={(e) => set(i, "team", e.target.value)}
                  />
                </td>
                <td>
                  <input className="field sm" aria-label={`${r.team || i + 1} 순위`} type="number" inputMode="numeric" min={1} max={8} value={r.placement} onChange={(e) => set(i, "placement", e.target.value)} />
                </td>
                <td>
                  <input className="field sm" aria-label={`${r.team || i + 1} 킬 점수`} type="number" inputMode="decimal" min={0} step={0.5} value={r.killScore} onChange={(e) => set(i, "killScore", e.target.value)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length < 8 && (
          <button type="button" className="link" onClick={() => setRows([...rows, { team: "", placement: "", killScore: "" }])}>
            팀 추가
          </button>
        )}
        {error && (
          <p className="text-[13px] text-minus" role="alert">
            <Lines text={error} />
          </p>
        )}
        <div className="acts">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" disabled={busy}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
