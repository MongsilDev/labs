"use client";

import { useState } from "react";
import Lines from "@/components/Lines";
import { api, type UploadToken } from "@/er/lib/client";
import { timeKo } from "@/er/lib/format";

const BOX = "panel px-5 py-[18px] [section+&]:mt-3.5";
const H2 = "flex flex-wrap items-baseline gap-2 text-[15px] font-bold";
const LI = "flex min-w-0 items-center gap-2.5 border-t border-line-soft py-[11px] text-[14px] max-[760px]:flex-wrap";
const ACTS = "ml-auto flex gap-1.5 max-[760px]:w-full";

export type AutoUploadInit = { on: boolean; fixed: boolean; token: UploadToken; paste: boolean };

function download(text: string, name: string) {
  // 감시 파일은 CRLF로 받아야 cmd가 읽으므로 줄바꿈을 건드리지 않는 형식으로 내려받음
  const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AutoUpload({
  code,
  owner,
  init,
  onMsg,
}: {
  code: string;
  owner: boolean;
  init: AutoUploadInit;
  onMsg: (text: string, bad?: boolean) => void;
}) {
  const [on, setOn] = useState(init.on);
  const [token, setToken] = useState(init.token);
  const [value, setValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState<null | "reissue" | "revoke">(null);
  const fail = (e: unknown) => onMsg(e instanceof Error ? e.message : "처리하지 못했습니다.\n잠시 후 다시 시도해주세요.", true);

  const issue = async () => {
    setBusy(true);
    try {
      const r = await api.uploadToken("issue");
      setToken(r.token);
      if (r.value) {
        setValue(r.value);
        onMsg("토큰을 만들었습니다.\n감시 파일을 실행하고 토큰을 붙여 넣어주세요.");
      } else {
        setValue(null);
        onMsg("감시 파일을 받았습니다.\nWin+R을 누르고 shell:startup을 입력해 열리는 폴더로 감시 파일을 옮긴 뒤 파일을 두 번 눌러주세요.");
      }
      download(r.script, r.fileName);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      await api.uploadToken("revoke");
      setToken(null);
      setValue(null);
      onMsg("토큰을 폐기했습니다.\n시작 프로그램 폴더의 감시 파일도 지워주세요.");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={BOX} aria-labelledby="au-h">
      <h2 className={H2} id="au-h">
        결과 자동 업로드
      </h2>
      <ul className="mt-2.5 list-none">
        {!init.fixed && (
          <li className={LI}>
            <b className="whitespace-nowrap">이 대회</b>
            <span className="chip">{on ? "켜짐" : "꺼짐"}</span>
            {owner && (
              <span className="ml-auto flex gap-1.5">
                <button
                  type="button"
                  className="btn sm"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      const r = await api.autoUpload(code, !on);
                      setOn(r.on);
                      onMsg(r.on ? "자동 업로드를 켰습니다." : "자동 업로드를 껐습니다.");
                    } catch (e) {
                      fail(e);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {on ? "끄기" : "켜기"}
                </button>
              </span>
            )}
          </li>
        )}
        <li className={LI}>
          <b className="whitespace-nowrap">내 토큰</b>
          <span className="min-w-0 text-[13px] text-fg-3">
            {token ? `${timeKo(token.createdAt)} 발급, ${token.lastUsedAt ? `마지막 업로드 ${timeKo(token.lastUsedAt)}` : "올린 기록 없음"}` : "없음"}
          </span>
          <span className={`${ACTS} max-[760px]:ml-0`}>
            {token ? (
              <>
                <button type="button" className="btn sm" disabled={busy} onClick={() => setAsk("reissue")}>
                  다시 받기
                </button>
                <button type="button" className="btn sm danger" disabled={busy} onClick={() => setAsk("revoke")}>
                  폐기
                </button>
              </>
            ) : (
              <button type="button" className="btn sm primary" disabled={busy} onClick={issue}>
                {init.paste ? "토큰 받기" : "감시 파일 받기"}
              </button>
            )}
          </span>
          {value && (
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2" role="status">
              <code className="min-w-0 flex-1 truncate text-fg-2 [font:inherit]" translate="no" aria-label="토큰">
                {value}
              </code>
              <button
                type="button"
                className="btn sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(value);
                    onMsg("토큰을 복사했습니다.");
                  } catch {
                    onMsg("복사하지 못했습니다.\n토큰을 직접 선택해 복사해주세요.", true);
                  }
                }}
              >
                복사
              </button>
            </div>
          )}
        </li>
      </ul>

      {ask && (
        <div className="dim" onMouseDown={(e) => e.target === e.currentTarget && setAsk(null)}>
          <form
            className="panel dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="au-cf-h"
            onSubmit={async (e) => {
              e.preventDefault();
              const kind = ask;
              setAsk(null);
              await (kind === "reissue" ? issue() : revoke());
            }}
          >
            <h2 id="au-cf-h">{ask === "reissue" ? "감시 파일을 다시 받을까요?" : "토큰을 폐기할까요?"}</h2>
            <p className="text-[13px] text-fg-3">
              <Lines text="전에 받은 감시 파일은 더 이상 결과를 올리지 못합니다." />
            </p>
            <div className="acts">
              <button type="button" className="btn" onClick={() => setAsk(null)}>
                취소
              </button>
              <button className={`btn ${ask === "reissue" ? "primary" : "danger"}`} autoFocus>
                {ask === "reissue" ? "다시 받기" : "폐기"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
