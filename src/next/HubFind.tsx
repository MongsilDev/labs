"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { comboPath, signed } from "@/er/lib/tier";
import Weapon from "./Weapon";

export type FindCombo = { char: number; key: string; name: string; weapon: number; weaponName: string; score: number };

const MODES = [
  ["er", "실험체"],
  ["code", "대회 코드"],
  ["tk", "타르코프 계정"],
] as const;

const squash = (s: string) => s.replace(/\s+/g, "");

/** 시안 4 찾기. 실험체는 받은 목록에서 바로 거르고, 대회 코드와 타르코프 계정은 받은 입력칸을 그대로 보임 */
export default function HubFind({ combos, head, code, tarkov }: { combos: FindCombo[]; head: React.ReactNode; code: React.ReactNode; tarkov: React.ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<(typeof MODES)[number][0]>("er");
  const [q, setQ] = useState("");
  const key = squash(q);
  // 점수 순으로 받은 목록이라 거른 뒤에도 점수 순
  const hits = (key ? combos.filter((c) => squash(c.weaponName + c.name).includes(key)) : combos).slice(0, 5);
  return (
    <div className="hub4">
      <fieldset className="seg">
        <legend className="sr-only">찾을 대상</legend>
        {MODES.map(([id, label]) => (
          <label key={id}>
            <input type="radio" name="hub-find" checked={mode === id} onChange={() => setMode(id)} />
            {label}
          </label>
        ))}
      </fieldset>
      <div className="hub4-body" hidden={mode !== "er"}>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (hits[0]) router.push(comboPath(hits[0]));
          }}
        >
          <input className="field" type="search" placeholder="실험체 또는 무기 이름" aria-label="실험체 또는 무기 이름" autoComplete="off" spellCheck={false} maxLength={20} value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {head}
        {hits.length > 0 ? (
          <ol>
            {hits.map((c) => (
              <li key={`${c.char}-${c.weapon}`} className="border-b border-rule">
                <Link href={comboPath(c)} className="flex h-14 items-center gap-3 text-[17px] font-semibold hover:bg-row hover:no-underline">
                  <Image className="size-9 flex-none rounded-[2px] bg-row object-cover" src={`/img/er/char/${c.key}.v1.webp`} alt="" width={36} height={36} unoptimized />
                  <Weapon code={c.weapon} name={c.weaponName} />
                  <span className="-ml-1 truncate">{c.name}</span>
                  <b className="ml-auto text-[20px] font-black num">{signed(c.score)}</b>
                </Link>
              </li>
            ))}
          </ol>
        ) : key ? (
          <p className="py-4 text-ink-3" role="status">
            실험체나 무기 이름을 다시 확인해주세요.
          </p>
        ) : null}
      </div>
      <div className="hub4-body" hidden={mode !== "code"}>
        {code}
      </div>
      <div className="hub4-body" hidden={mode !== "tk"}>
        {tarkov}
      </div>
    </div>
  );
}
