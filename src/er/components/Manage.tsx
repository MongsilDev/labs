"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { api } from "@/er/lib/client";
import { ago, timeKo } from "@/er/lib/format";
import { LIMITS, PRESET_LABEL, groupLabel, presetRules, type Mode, type Preset, type Rules } from "@/er/lib/rules";
import { useNow } from "@/er/lib/useNow";
import type { DiscordLinkRow, InviteRow, MemberRow, RelayStatus, TournamentView } from "@/er/lib/view";
import Avatar from "./Avatar";
import ModeSeg from "./ModeSeg";
import RulesFields from "./RulesFields";
import Lines from "@/components/Lines";

const BOX = "panel px-5 py-[18px] [section+&]:mt-3.5";
const H2 = "flex flex-wrap items-baseline gap-2 text-[15px] font-bold";
const LI = "flex min-w-0 items-center gap-2.5 border-t border-line-soft py-[11px] text-[14px] max-[760px]:flex-wrap";
const ACTS = "ml-auto flex gap-1.5 max-[760px]:w-full";

type Ask = { kind: "transfer" | "remove"; user: MemberRow } | { kind: "delete" };

export default function Manage({
  view,
  me,
  initialMembers,
  initialInvites,
  initialLinks,
}: {
  view: TournamentView;
  me: string;
  initialMembers: MemberRow[];
  initialInvites: InviteRow[];
  initialLinks: DiscordLinkRow[];
}) {
  const router = useRouter();
  const [list, setList] = useState(initialMembers);
  const [invites, setInvites] = useState(initialInvites);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [uses, setUses] = useState(1);
  const [confirm, setConfirm] = useState<null | Ask>(null);
  const [links, setLinks] = useState(initialLinks);
  const owner = view.role === "owner";
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "",
  );
  const inviteUrl = (t: string) => `${origin}/er/i/${t}`;
  const slots = LIMITS.operators - list.filter((m) => m.role === "operator").length - invites.reduce((n, i) => n + i.usesLeft, 0);
  const pick = Math.min(uses, Math.max(1, slots));

  const reload = async () => {
    const d = await api.members(view.code);
    setList(d.members.map((m) => ({ ...m, avatar: m.avatar ? `https://cdn.discordapp.com/avatars/${m.id}/${m.avatar}.webp?size=64` : null })));
    setInvites(d.invites);
  };
  const act = async (body: { action: string; token?: string; user?: string; uses?: number }, done?: string) => {
    try {
      const r = await api.member(view.code, body);
      if (done) setMsg({ text: done });
      await reload();
      return r;
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : "처리하지 못했습니다.", bad: true });
    }
  };

  return (
    <main id="main" className="wrap slim">
      <Link className="text-[13px] text-fg-3 no-underline" href={`/er/t/${view.code}/a`}>
        대회 화면으로 돌아가기
      </Link>
      <h1 className="mt-1.5 mb-0.5 text-[28px] font-extrabold tracking-[-0.5px]">운영자{owner ? "와 설정" : ""}</h1>
      <p className="mb-[18px] text-[14px] text-fg-3">
        {view.name}, 대회 코드 <b translate="no">{view.code}</b>
      </p>
      {msg && (
        <p className={`panel mb-3.5 border-minus px-4 py-3${msg.bad ? " text-minus" : ""}`} role={msg.bad ? "alert" : "status"}>
          <Lines text={msg.text} />
        </p>
      )}

      <section className={BOX} aria-labelledby="m-h">
        <h2 className={H2} id="m-h">
          운영자 <span className="text-[13px] font-medium text-fg-3">{list.filter((m) => m.role === "operator").length}명, 개최자 외 최대 {LIMITS.operators}명</span>
        </h2>
        <ul className="mt-2.5 list-none">
          {list.map((m) => (
            <li key={m.id} className={LI}>
              <Avatar name={m.name} src={m.avatar} />
              <b className="min-w-0 truncate">{m.name}</b>
              {m.role === "owner" ? <span className="chip">개최자</span> : <span className="text-[13px] whitespace-nowrap text-fg-3">{timeKo(m.joinedAt)} 참여</span>}
              <span className={`${ACTS} max-[760px]:ml-[34px]`}>
                {owner && m.role === "operator" && (
                  <>
                    <button type="button" className="btn sm" onClick={() => setConfirm({ kind: "transfer", user: m })}>
                      개최자 넘기기
                    </button>
                    <button type="button" className="btn sm danger" onClick={() => setConfirm({ kind: "remove", user: m })}>
                      운영자에서 빼기
                    </button>
                  </>
                )}
                {!owner && m.id === me && (
                  <button
                    type="button"
                    className="btn sm danger"
                    onClick={async () => {
                      await act({ action: "leave" });
                      router.push(`/er/t/${view.code}/a`);
                    }}
                  >
                    운영자 그만두기
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {owner && (
        <section className={BOX} aria-labelledby="i-h">
          <h2 className={H2} id="i-h">
            초대 링크
          </h2>
          {invites.length > 0 && (
            <ul className="mt-2.5 list-none">
              {invites.map((i) => (
                <li key={i.token} className={LI}>
                  <code className="min-w-0 flex-1 truncate text-fg-2 [font:inherit]" translate="no">
                    {inviteUrl(i.token).replace(/^https?:\/\//, "")}
                  </code>
                  <span className="text-[13px] whitespace-nowrap text-fg-2">남은 {i.usesLeft}명</span>
                  <span className={`${ACTS} max-[760px]:ml-0`}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(inviteUrl(i.token));
                          setMsg({ text: "초대 링크를 복사했습니다." });
                        } catch {
                          setMsg({ text: "복사하지 못했습니다. 링크를 직접 선택해 복사해주세요.", bad: true });
                        }
                      }}
                    >
                      복사
                    </button>
                    <button type="button" className="btn sm" onClick={() => act({ action: "cancel", token: i.token }, "초대 링크를 취소했습니다.")}>
                      취소
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {slots > 0 ? (
            <div className="mt-3.5 grid grid-cols-[auto_96px_auto] items-center justify-start gap-2.5">
              <label className="lbl m-0" htmlFor="inv-uses">
                인원
              </label>
              <select id="inv-uses" className="field" value={pick} onChange={(e) => setUses(Number(e.target.value))}>
                {Array.from({ length: slots }, (_, k) => (
                  <option key={k + 1} value={k + 1}>
                    {k + 1}명
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn primary"
                onClick={async () => {
                  const r = await act({ action: "invite", uses: pick });
                  if (r?.token) {
                    setUses(1);
                    try {
                      await navigator.clipboard.writeText(inviteUrl(r.token));
                      setMsg({ text: `초대 링크를 만들고 복사했습니다. ${pick}명까지 이 링크로 운영자가 될 수 있습니다.` });
                    } catch {
                      setMsg({ text: "초대 링크를 만들었습니다. 위 목록에서 복사해주세요." });
                    }
                  }
                }}
              >
                초대 링크 만들기
              </button>
            </div>
          ) : (
            <p className="text-[13px] text-fg-3" style={{ marginTop: 12 }}>
              <Lines text={`운영자는 개최자 외 최대 ${LIMITS.operators}명이고 남은 자리가 없습니다. 더 초대하려면 쓰지 않을 링크를 취소하거나 운영자를 빼주세요.`} />
            </p>
          )}
        </section>
      )}

      <Discord
        view={view}
        links={links}
        onUnlink={async (group) => {
          try {
            await api.op(view.code, { op: "unlink_discord", group });
            setLinks((l) => l.filter((x) => x.group !== group));
            setMsg({ text: view.groupCount > 1 ? `${groupLabel(group)}조 디스코드 연결을 해제했습니다.` : "디스코드 연결을 해제했습니다." });
          } catch (e) {
            setMsg({ text: e instanceof Error ? e.message : "연결을 해제하지 못했습니다.", bad: true });
          }
        }}
        onMsg={(text, bad) => setMsg({ text, bad })}
      />

      {owner && <Settings view={view} onSaved={(t) => setMsg({ text: t })} onError={(t) => setMsg({ text: t, bad: true })} />}

      {owner && (
        <section className={BOX} aria-labelledby="d-h">
          <h2 className={H2} id="d-h">대회 삭제</h2>
          <p className="text-[13px] text-fg-3" style={{ marginTop: 6 }}>
            순위, CSV, 변경 기록이 모두 지워지고 되돌릴 수 없습니다.
          </p>
          <button type="button" className="btn danger" style={{ marginTop: 12 }} onClick={() => setConfirm({ kind: "delete" })}>
            대회 삭제
          </button>
        </section>
      )}

      {confirm && (
        <Confirm
          confirm={confirm}
          name={view.name}
          onClose={() => setConfirm(null)}
          onOk={async (typed) => {
            if (confirm.kind === "delete") {
              try {
                await api.remove(view.code, typed);
                router.push("/er/score");
              } catch (e) {
                setMsg({ text: e instanceof Error ? e.message : "삭제하지 못했습니다.", bad: true });
              }
            } else if (confirm.kind === "transfer") {
              await act({ action: "transfer", user: confirm.user.id }, `${confirm.user.name}님에게 개최자를 넘겼습니다.`);
              router.refresh();
            } else {
              await act({ action: "remove", user: confirm.user.id }, `${confirm.user.name}님을 운영자에서 뺐습니다.`);
            }
            setConfirm(null);
          }}
        />
      )}
    </main>
  );
}

const RELAY_LABEL: Record<RelayStatus, string> = { added: "반영", duplicate: "중복", invalid: "형식 오류", ended: "끝남" };

function Discord({
  view,
  links,
  onUnlink,
  onMsg,
}: {
  view: TournamentView;
  links: DiscordLinkRow[];
  onUnlink: (group: number) => Promise<void>;
  onMsg: (text: string, bad?: boolean) => void;
}) {
  const now = useNow();
  const [busy, setBusy] = useState<number | null>(null);
  const guilds = [...new Set(links.map((l) => l.guild))];
  const command = `/대회 ${view.code}`;
  return (
    <section className={BOX} aria-labelledby="dc-h">
      <h2 className={H2} id="dc-h">
        디스코드
        {guilds.length === 1 && guilds[0] && <span className="min-w-0 truncate text-[13px] font-medium text-fg-3">{guilds[0]}</span>}
      </h2>
      <ul className="mt-2.5 list-none">
        {Array.from({ length: view.groupCount }, (_, g) => {
          const l = links.find((x) => x.group === g);
          const last = l?.last;
          return (
            <li key={g} className={LI}>
              {view.groupCount > 1 && <b className="whitespace-nowrap">{groupLabel(g)}조</b>}
              {l ? (
                <>
                  {guilds.length > 1 && <span className="min-w-0 truncate text-[13px] text-fg-3">{l.guild}</span>}
                  <span className="min-w-0 truncate">#{l.channel}</span>
                  {last && (
                    <>
                      <span className="text-[13px] whitespace-nowrap text-fg-3">
                        {[last.round && `${last.round}라운드`, now && ago(last.at, now), last.user].filter(Boolean).join(", ")}
                      </span>
                      <span className={`chip${last.status === "invalid" ? " border-minus text-minus" : ""}`}>{RELAY_LABEL[last.status]}</span>
                    </>
                  )}
                  <span className={`${ACTS} max-[760px]:ml-0`}>
                    <button
                      type="button"
                      className="btn sm"
                      disabled={busy !== null}
                      onClick={async () => {
                        setBusy(g);
                        await onUnlink(g);
                        setBusy(null);
                      }}
                    >
                      연결 해제
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-fg-3">연결 안 됨</span>
                  <code className="rounded-[4px] bg-field px-1.5 py-0.5 font-mono text-[13px] whitespace-nowrap text-fg-2" translate="no">
                    {command}
                  </code>
                  <span className={`${ACTS} max-[760px]:ml-0`}>
                    <button
                      type="button"
                      className="btn sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(command);
                          onMsg("명령어를 복사했습니다.");
                        } catch {
                          onMsg("복사하지 못했습니다. 명령어를 직접 선택해 복사해주세요.", true);
                        }
                      }}
                    >
                      복사
                    </button>
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Settings({ view, onSaved, onError }: { view: TournamentView; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState(view.name);
  const [mode, setMode] = useState<Mode>(view.mode);
  const [preset, setPreset] = useState<Preset>(view.rules.preset);
  const [rules, setRules] = useState<Rules>(view.rules);
  const [rounds, setRounds] = useState(view.plannedRounds);
  const [groups, setGroups] = useState(view.groupCount);
  const [busy, setBusy] = useState(false);
  return (
    <section className={BOX} aria-labelledby="s-h">
      <h2 className={H2} id="s-h">대회 설정</h2>
      <form
        className="mt-3 grid gap-3.5"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await api.op(view.code, { op: "update_settings", name, mode, preset, rules, plannedRounds: rounds, groupCount: groups });
            onSaved("설정을 저장했습니다.");
            router.refresh();
          } catch (err) {
            onError(err instanceof Error ? err.message : "저장하지 못했습니다.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label className="lbl" htmlFor="s-name">대회 이름</label>
          <input id="s-name" className="field" maxLength={LIMITS.nameLength} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </div>
        <ModeSeg mode={mode} onChange={setMode} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3 max-[760px]:grid-cols-[1fr_1fr]">
          <div className="max-[760px]:col-span-full">
            <label className="lbl" htmlFor="s-rule">순위 점수</label>
            <select
              id="s-rule"
              className="field"
              value={preset}
              onChange={(e) => {
                const p = e.target.value as Preset;
                setPreset(p);
                setRules({ ...presetRules(p), advance: rules.advance });
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
            <label className="lbl" htmlFor="s-rounds">{mode === "points" ? "라운드 수" : "최대 라운드 수"}</label>
            <input id="s-rounds" className="field" type="number" inputMode="numeric" min={1} max={LIMITS.rounds} value={rounds} onChange={(e) => setRounds(Number(e.target.value) || 1)} />
          </div>
          <div>
            <label className="lbl" htmlFor="s-groups">조 수</label>
            <input id="s-groups" className="field" type="number" inputMode="numeric" min={1} max={LIMITS.groups} value={groups} onChange={(e) => setGroups(Number(e.target.value) || 1)} />
          </div>
        </div>
        <RulesFields rules={rules} mode={mode} rounds={rounds} onChange={setRules} />
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn primary" disabled={busy}>
            설정 저장
          </button>
        </div>
      </form>
    </section>
  );
}

function Confirm({
  confirm,
  name,
  onClose,
  onOk,
}: {
  confirm: Ask;
  name: string;
  onClose: () => void;
  onOk: (typed: string) => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const title =
    confirm.kind === "delete"
      ? "대회를 삭제할까요?"
      : confirm.kind === "transfer" ? `${confirm.user.name}님에게 개최자를 넘길까요?` : `${confirm.user.name}님을 운영자에서 뺄까요?`;
  const body =
    confirm.kind === "delete"
      ? "확인을 위해 대회 이름을 입력해주세요."
      : confirm.kind === "transfer"
        ? "넘기면 본인은 운영자가 되고, 설정과 운영자 관리는 새 개최자만 할 수 있습니다."
        : "다시 운영을 맡기려면 새 초대 링크를 보내야 합니다.";
  return (
    <div className="dim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="panel dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cf-h"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onOk(typed);
          setBusy(false);
        }}
      >
        <h2 id="cf-h">{title}</h2>
        <p className="text-[13px] text-fg-3">{body}</p>
        {confirm.kind === "delete" && (
          <input className="field" style={{ marginTop: 12 }} aria-label="대회 이름" placeholder={name} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus />
        )}
        <div className="acts">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button className={`btn ${confirm.kind === "transfer" ? "primary" : "danger"}`} disabled={busy || (confirm.kind === "delete" && typed.trim() !== name)}>
            {confirm.kind === "delete" ? "삭제" : confirm.kind === "transfer" ? "넘기기" : "빼기"}
          </button>
        </div>
      </form>
    </div>
  );
}
