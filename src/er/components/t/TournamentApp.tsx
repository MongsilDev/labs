"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { api, rememberRecent } from "@/er/lib/client";
import { computeGroup, type GroupResult } from "@/er/lib/engine";
import { boardImage, download, playersImage, standingsCsv } from "@/er/lib/export";
import { remaining } from "@/er/lib/format";
import { useNow } from "@/er/lib/useNow";
import { LIMITS, MODE_LABEL, PRESET_LABEL } from "@/er/lib/rules";
import type { Op, TournamentView } from "@/er/lib/view";
import Details from "./Details";
import ManualRound from "./ManualRound";
import Rounds, { DiscordMark } from "./Rounds";
import { Logs, Penalties, Teams } from "./Side";
import Standings from "./Standings";
import Lines from "@/components/Lines";

type Toast = { id: number; text: string; bad?: boolean; undo?: Op; undoLabel?: string };

export function useResult(view: TournamentView, idx: number): GroupResult {
  return useMemo(() => {
    const g = view.groups[idx];
    return computeGroup({
      mode: view.mode,
      rules: view.rules,
      plannedRounds: view.plannedRounds,
      rounds: g.rounds.map((r) => ({ roundNo: r.roundNo, source: r.source, gameId: r.gameId, players: r.players })),
      penalties: g.penalties,
      weather: g.weather,
      aliases: g.aliases,
      overrides: g.overrides,
    });
  }, [view, idx]);
}

export default function TournamentApp({ initial, groupIdx, basePath, created = false }: { initial: TournamentView; groupIdx: number; basePath: string; created?: boolean }) {
  const [view, setView] = useState(initial);
  const [preview, setPreview] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [manual, setManual] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const [welcome, setWelcome] = useState(created);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetRound = useRef<number | undefined>(undefined);
  const versionRef = useRef(initial.version);
  const roleRef = useRef(initial.role);
  const now = useNow();
  const example = Boolean(view.example);
  const group = view.groups[groupIdx] ?? view.groups[0];
  const result = useResult(view, view.groups[groupIdx] ? groupIdx : 0);
  const router = useRouter();
  useEffect(() => {
    if (!view.groups[groupIdx]) router.replace(`${basePath}/a`);
  }, [view.groups, groupIdx, basePath, router]);
  const operator = !example && !preview && view.role !== null;
  const label = view.groupCount > 1 ? `${group.label}조` : view.name;
  const linked = view.discord?.find((d) => d.group === group.idx);

  const toast = useCallback((t: Omit<Toast, "id">, ms = 5000) => {
    const id = Date.now() + Math.random();
    setToasts((list) => [...list.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), ms);
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (example) return;
      try {
        const next = await api.view(view.code, force ? undefined : versionRef.current);
        if (!next || next.version < versionRef.current) return;
        if (roleRef.current && !next.role) toast({ text: "운영자 권한이 해제돼 참가자 화면으로 바뀌었습니다.", bad: true }, 8000);
        roleRef.current = next.role;
        versionRef.current = next.version;
        setView(next);
      } catch (e) {
        if ((e as { status?: number }).status === 404) setGone(true);
      }
    },
    [example, view.code, toast],
  );

  useEffect(() => {
    if (!example) rememberRecent(view.code, view.name);
  }, [example, view.code, view.name]);

  useEffect(() => {
    if (example || gone) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(tick, 5000);
    const vis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [example, gone, refresh]);

  const run = useCallback(
    async (op: Op) => {
      try {
        const res = await api.op(view.code, op);
        for (const n of res.notices) toast({ text: n });
        for (const e of res.errors) toast({ text: e, bad: true }, 9000);
        if (res.undo) {
          const msg = op.op === "delete_round" ? "라운드를 지웠습니다." : op.op === "delete_penalty" ? "감점을 지웠습니다." : "기존 라운드 기록을 새 기록으로 바꿨습니다.";
          toast({ text: msg, undo: res.undo.op, undoLabel: op.op === "delete_round" || op.op === "delete_penalty" ? "되돌리기" : "이전 기록 되살리기" }, 6000);
        }
        await refresh(true);
        return res;
      } catch (e) {
        toast({ text: e instanceof Error ? e.message : "처리하지 못했습니다.\n잠시 후 다시 시도해주세요.", bad: true }, 9000);
        if ((e as { status?: number }).status === 401 || (e as { status?: number }).status === 400) refresh(true);
        throw e;
      }
    },
    [view.code, refresh, toast],
  );

  const upload = useCallback(
    async (files: File[], round?: number) => {
      const csvs = files.filter((f) => /\.csv$/i.test(f.name) || f.type === "text/csv");
      if (csvs.length === 0) return toast({ text: "CSV 파일만 올릴 수 있습니다.", bad: true });
      const big = csvs.filter((f) => f.size > LIMITS.csvBytes);
      for (const f of big) toast({ text: `${f.name}: 200KB가 넘는 파일은 올릴 수 없습니다.`, bad: true });
      const ok = csvs.filter((f) => f.size <= LIMITS.csvBytes);
      if (ok.length === 0) return;
      const payload = await Promise.all(ok.map(async (f) => ({ name: f.name, text: await f.text() })));
      await run({ op: "add_csv", group: group.idx, files: payload, round: ok.length === 1 ? round : undefined }).catch(() => {});
    },
    [group.idx, run, toast],
  );

  useEffect(() => {
    if (!operator) return;
    let depth = 0;
    const has = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const enter = (e: DragEvent) => {
      if (!has(e)) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const over = (e: DragEvent) => has(e) && e.preventDefault();
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!has(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      upload(Array.from(e.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [operator, upload]);

  const pickFiles = (round?: number) => {
    targetRound.current = round;
    fileRef.current?.click();
  };

  const meta = { name: view.name, group: view.groupCount > 1 ? group.label : null, mode: view.mode, rules: view.rules };
  const fileBase = `${view.name}${view.groupCount > 1 ? ` ${group.label}조` : ""}`;
  const exportBoard = async () => download(await boardImage(result, meta), `${fileBase} 순위표.png`);
  const exportPlayers = async () => download(await playersImage(result, meta), `${fileBase} 선수 기록.png`);
  const exportCsv = () => download(new Blob([standingsCsv(result)], { type: "text/csv;charset=utf-8" }), `${fileBase} 순위.csv`);
  const copy = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ text: done });
    } catch {
      toast({ text: `복사하지 못했습니다.\n아래 주소를 직접 복사해주세요.\n${text}`, bad: true }, 15000);
    }
  };
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const status = result.ended ? (view.groupCount > 1 ? "경기 종료" : "대회 종료") : result.played === 0 ? "경기 전" : `${result.played}라운드 종료`;

  if (gone) {
    return (
      <main id="main" className="wrap slim">
        <section className="panel mt-6 grid justify-items-start gap-2.5 p-7">
          <h1 className="text-[22px]">없거나 지워진 대회입니다</h1>
          <p className="text-fg-3">대회는 마지막으로 수정한 지 24시간이 지나면 자동으로 삭제됩니다.</p>
          <Link className="btn primary" href="/er/score">
            새 대회 만들기
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main id="main" className="wrap wide pt-[18px]">
      {operator || (preview && view.role) ? (
        <div className="mb-[18px] flex flex-wrap items-center gap-2.5 rounded-lg border border-line bg-surface px-3.5 py-2.5" role="region" aria-label="운영 도구">
          <span className="flex items-center gap-2 text-[13px] text-fg-2">
            <i className="size-[7px] rounded-full bg-accent" aria-hidden="true" />
            {preview ? "참가자 화면 미리 보기" : view.role === "owner" ? "개최자" : "운영자"}
            {now !== null && `, ${remaining(view.expiresAt, now)}`}
          </span>
          {!preview && (
            <Link
              className="flex min-w-0 items-center gap-1.5 text-[13px] text-fg-2 no-underline hover:text-fg"
              href={`/er/t/${view.code}/manage#dc-h`}
              aria-label={linked ? `디스코드 #${linked.channel}` : "디스코드 연결 안 됨"}
            >
              <DiscordMark />
              <span className={`min-w-0 truncate${linked ? "" : " text-fg-3"}`}>{linked ? `#${linked.channel}` : "연결 안 됨"}</span>
            </Link>
          )}
          <div className="ml-auto flex flex-wrap gap-2 max-[760px]:ml-0">
            {!preview && (
              <>
                <button type="button" className="btn sm" onClick={() => copy(`${origin}/er/t/${view.code}`, "보기 링크를 복사했습니다.")}>
                  보기 링크 복사
                </button>
                <Link className="btn sm" href={`/er/t/${view.code}/manage`}>
                  관리
                </Link>
              </>
            )}
            <button type="button" className="btn sm" aria-pressed={preview} onClick={() => setPreview(!preview)}>
              {preview ? "운영 화면" : "참가자 화면"}
            </button>
          </div>
        </div>
      ) : null}

      {welcome && operator && (
        <section className="panel mb-[18px] grid gap-3 border-accent px-5 py-[18px]" aria-labelledby="welcome-h">
          <h2 className="text-[15px] font-bold" id="welcome-h">대회를 만들었습니다</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-fg-3">대회 코드</span>
            <b className="text-[30px] font-extrabold tracking-[4px]" translate="no">{view.code}</b>
          </div>
          <div className="flex flex-wrap justify-start gap-2">
            <button type="button" className="btn primary" onClick={() => copy(`${origin}/er/t/${view.code}`, "보기 링크를 복사했습니다.")}>
              보기 링크 복사
            </button>
            <Link className="btn" href={`/er/t/${view.code}/manage`}>
              운영자 초대
            </Link>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setWelcome(false);
                window.history.replaceState(null, "", window.location.pathname);
              }}
            >
              닫기
            </button>
          </div>
        </section>
      )}

      <div className="mb-3.5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="flex flex-wrap items-center gap-2.5 text-[26px] font-extrabold tracking-[-0.4px]">
            {view.name}
            {example && <span className="chip dashed">예시</span>}
          </h1>
          <p className="text-[14px] text-fg-3">
            {MODE_LABEL[view.mode]} {view.mode === "points" ? `${view.plannedRounds}라운드` : `최대 ${view.plannedRounds}라운드`}, {view.rules.preset === "custom" ? "직접 정한 순위 점수" : PRESET_LABEL.masters}
            {!example && (
              <>
                ,{" "}
                <span className="whitespace-nowrap">
                  대회 코드 <b translate="no">{view.code}</b>
                </span>
              </>
            )}
            {view.source && (
              <>
                , 경기 기록{" "}
                <a href={view.source.url} target="_blank" rel="noopener noreferrer">
                  {view.source.name}
                </a>
              </>
            )}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2 max-[760px]:ml-0 max-[760px]:w-full max-[760px]:*:flex-1">
          {operator && (
            <button type="button" className="btn" onClick={() => pickFiles()}>
              CSV 추가
            </button>
          )}
          {!example && (
            <button type="button" className="btn" onClick={() => copy(`${origin}/er/t/${view.code}/${group.label.toLowerCase()}/overlay`, "방송 화면 주소를 복사했습니다.")}>
              방송 화면 주소 복사
            </button>
          )}
          <ExportMenu disabled={result.played === 0} onBoard={exportBoard} onPlayers={exportPlayers} onCsv={exportCsv} hasPlayers={result.players.length > 0} />
        </div>
      </div>

      {view.groupCount > 1 && (
        <div className="mb-3.5 flex flex-wrap items-center gap-3">
          <nav className="tabs groups" aria-label="조">
            {view.groups.map((g) => (
              <Link key={g.idx} href={`${basePath}/${g.label.toLowerCase()}`} aria-current={g.idx === groupIdx ? "page" : undefined} scroll={false}>
                {g.label}조
              </Link>
            ))}
          </nav>
          <span className="text-[14px] text-fg-3">
            {group.label}조 {status}
          </span>
        </div>
      )}

      {operator && result.played === 0 ? (
        <section className="panel mb-4 grid justify-items-start gap-3 border-[1.5px] border-dashed p-5">
          <p className="text-[15px] font-bold">CSV 파일 끌어 놓기</p>
          <div className="flex flex-wrap justify-start gap-2">
            <button type="button" className="btn primary" onClick={() => pickFiles()}>
              파일 선택
            </button>
            <button type="button" className="btn" onClick={() => setManual(1)}>
              직접 입력
            </button>
          </div>
          {result.next && (
            <Rounds group={group} result={result} mode={view.mode} planned={view.plannedRounds} multi={view.groupCount > 1} editable={operator} run={run} pickFiles={pickFiles} openManual={setManual} />
          )}
        </section>
      ) : (
        <Rounds group={group} result={result} mode={view.mode} planned={view.plannedRounds} multi={view.groupCount > 1} editable={operator} run={run} pickFiles={pickFiles} openManual={setManual} />
      )}

      <div className={`grid items-start gap-4 ${operator ? "cols grid-cols-[minmax(0,1fr)_340px] max-[1100px]:grid-cols-[minmax(0,1fr)]" : "grid-cols-[minmax(0,1fr)]"}`}>
        <div className="min-w-0 max-[1100px]:contents">
          <Standings result={result} rules={view.rules} mode={view.mode} label={label} />
          <Details result={result} rules={view.rules} />
        </div>
        {operator && (
          <div className="grid min-w-0 gap-3 max-[1100px]:contents">
            <div className="grid min-w-0 gap-3 max-[1100px]:order-1">
              <Penalties group={group} result={result} rules={view.rules} run={run} />
              <Teams group={group} result={result} mode={view.mode} rules={view.rules} run={run} />
            </div>
            {view.logs && (
              <div className="min-w-0 max-[1100px]:order-3">
                <Logs logs={view.logs} now={now} />
              </div>
            )}
          </div>
        )}
      </div>

      {operator && (
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) upload(files, targetRound.current);
          }}
        />
      )}
      {manual !== null && (
        <ManualRound
          round={manual}
          teams={result.standings.map((s) => s.name)}
          onClose={() => setManual(null)}
          onSave={async (teams) => {
            await run({ op: "add_manual", group: group.idx, round: manual, teams });
            setManual(null);
          }}
        />
      )}
      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div>{group.label && view.groupCount > 1 ? `${group.label}조에 CSV 올리기` : "CSV 올리기"}</div>
        </div>
      )}
      <div className="toast-area" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.bad ? " bad" : ""}`} role={t.bad ? "alert" : "status"}>
            <span>
              <Lines text={t.text} />
            </span>
            {t.undo && (
              <button
                type="button"
                onClick={() => {
                  setToasts((list) => list.filter((x) => x.id !== t.id));
                  run(t.undo!).catch(() => {});
                }}
              >
                {t.undoLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

function ExportMenu({ disabled, hasPlayers, onBoard, onPlayers, onCsv }: { disabled: boolean; hasPlayers: boolean; onBoard: () => Promise<void>; onPlayers: () => Promise<void>; onCsv: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const act = (fn: () => Promise<void> | void) => async () => {
    setOpen(false);
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relative" ref={ref}>
      <button type="button" className="btn primary max-[760px]:w-full" aria-haspopup="menu" aria-expanded={open} disabled={disabled || busy} onClick={() => setOpen(!open)}>
        {busy ? "만드는 중" : "내보내기"}
      </button>
      {open && (
        <div className="menu-pop panel" role="menu">
          <button type="button" role="menuitem" onClick={act(onBoard)}>
            순위표 이미지
          </button>
          {hasPlayers && (
            <button type="button" role="menuitem" onClick={act(onPlayers)}>
              선수 기록 이미지
            </button>
          )}
          <button type="button" role="menuitem" onClick={act(onCsv)}>
            순위 CSV
          </button>
        </div>
      )}
    </div>
  );
}
