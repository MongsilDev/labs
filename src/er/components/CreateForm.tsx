"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/er/lib/client";
import { LIMITS, PLACEMENT_POINTS, PRESET_LABEL, presetRules, type Mode, type Preset, type Rules } from "@/er/lib/rules";
import type { CreateInput } from "@/er/lib/view";
import ModeSeg from "./ModeSeg";
import RulesFields from "./RulesFields";
import Lines from "@/components/Lines";

const DRAFT = "er-draft";

export default function CreateForm({ loggedIn, autoCreate }: { loggedIn: boolean; autoCreate: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("points");
  const [preset, setPreset] = useState<Preset>("masters");
  const [rules, setRules] = useState<Rules>(() => presetRules("masters"));
  const [rounds, setRounds] = useState(4);
  const [groups, setGroups] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const input = (): CreateInput => ({ name, mode, preset, plannedRounds: rounds, groupCount: groups, rules });

  const create = async (data: CreateInput) => {
    setBusy(true);
    setError("");
    try {
      const { code } = await api.create(data);
      sessionStorage.removeItem(DRAFT);
      router.push(`/er/t/${code}/a?created=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "대회를 만들지 못했습니다.\n잠시 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoCreate || !loggedIn) return;
    const raw = sessionStorage.getItem(DRAFT);
    if (!raw) return;
    const timer = setTimeout(() => {
      sessionStorage.removeItem(DRAFT);
      try {
        const d = JSON.parse(raw) as CreateInput;
        setName(d.name);
        setMode(d.mode);
        setPreset(d.preset);
        if (d.rules) setRules(d.rules as Rules);
        setRounds(d.plannedRounds);
        setGroups(d.groupCount);
        create(d);
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCreate, loggedIn]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("대회 이름을 입력해주세요.");
    if (!loggedIn) {
      sessionStorage.setItem(DRAFT, JSON.stringify(input()));
      // 로그인 경로는 페이지가 아닌 라우트 핸들러라 전체 이동 필요
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = `/auth/login?next=${encodeURIComponent("/er/score?create=1")}`;
      return;
    }
    create(input());
  };

  return (
    <form className="panel grid gap-[18px] p-[22px]" onSubmit={submit} noValidate>
      <div>
        <label className="lbl" htmlFor="c-name">대회 이름</label>
        <input
          id="c-name"
          name="tournament"
          className="field"
          autoComplete="off"
          maxLength={LIMITS.nameLength}
          placeholder="제2회 루미아 컵"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={error === "대회 이름을 입력해주세요." || undefined}
        />
      </div>
      <ModeSeg
        mode={mode}
        onChange={(m) => {
          setMode(m);
          if (m !== "points" && rounds < 9) setRounds(12);
          if (m === "points" && rounds === 12) setRounds(4);
        }}
      />
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 max-[760px]:grid-cols-[1fr_1fr]">
        <div className="max-[760px]:col-span-full">
          <label className="lbl" htmlFor="c-rule">순위 점수</label>
          <select
            id="c-rule"
            className="field"
            value={preset}
            onChange={(e) => {
              const p = e.target.value as Preset;
              setPreset(p);
              setRules({ ...rules, preset: p, placementPoints: [...PLACEMENT_POINTS], killMultiplier: 1 });
              if (p === "custom") setDetailsOpen(true);
            }}
          >
            {(Object.keys(PRESET_LABEL) as Preset[]).map((p) => (
              <option key={p} value={p}>
                {PRESET_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl" htmlFor="c-rounds">{mode === "points" ? "라운드 수" : "최대 라운드 수"}</label>
          <input id="c-rounds" className="field" type="number" inputMode="numeric" min={1} max={LIMITS.rounds} value={rounds} onChange={(e) => setRounds(Math.max(1, Math.min(LIMITS.rounds, Number(e.target.value) || 1)))} />
        </div>
        <div>
          <label className="lbl" htmlFor="c-groups">조 수</label>
          <input id="c-groups" className="field" type="number" inputMode="numeric" min={1} max={LIMITS.groups} value={groups} onChange={(e) => setGroups(Math.max(1, Math.min(LIMITS.groups, Number(e.target.value) || 1)))} />
        </div>
      </div>
      <details open={detailsOpen} onToggle={(e) => setDetailsOpen(e.currentTarget.open)}>
        <summary className="w-max cursor-pointer text-[14px] font-semibold text-fg-2">세부 규칙</summary>
        <RulesFields
          rules={rules}
          mode={mode}
          rounds={rounds}
          onChange={setRules}
        />
      </details>
      {error && (
        <p className="text-[13px] text-minus" role="alert">
          <Lines text={error} />
        </p>
      )}
      <button className={`btn lg w-full ${loggedIn ? "primary" : "discord"}`} disabled={busy}>
        {busy ? "만드는 중" : loggedIn ? "대회 만들기" : "디스코드로 로그인하고 만들기"}
      </button>
    </form>
  );
}
