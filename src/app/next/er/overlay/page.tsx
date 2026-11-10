import Link from "next/link";
import Shell from "@/next/Shell";
import CopyField from "@/next/CopyField";
import { overlayPlace, PRESETS, type PresetKey } from "@/er/lib/rank";
import { BASE_URL } from "@/er/server/auth";

export const metadata = { title: "오버레이" };

const NAMES: [PresetKey, string][] = [["t1", "왼쪽 아래"], ["t2", "오른쪽 위 한 줄"], ["t3", "오른쪽 위"]];
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
const px = (v: string | undefined) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
};

export default async function NextOverlay({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const asked = one(q.n) !== undefined;
  const nick = (one(q.n) ?? "").trim().slice(0, 32);
  const { preset } = overlayPlace(one(q.p));
  const x = px(one(q.x)), y = px(one(q.y));
  const url = `${BASE_URL}/er/rank/overlay?n=${encodeURIComponent(nick)}&p=${preset}${x || y ? `&x=${x}&y=${y}` : ""}`;
  return (
    <Shell here="overlay">
      <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">오버레이</h1>
      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section className="sec" aria-labelledby="rank-h">
          <h2 id="rank-h" className="sec-h">랭크 오버레이</h2>
          <form className="mt-4 grid max-w-[560px] gap-5" noValidate>
            <div>
              <label className="lbl" htmlFor="n">닉네임</label>
              <input id="n" name="n" className="field" defaultValue={nick} autoComplete="off" spellCheck={false} maxLength={32} aria-describedby="n-msg" />
              <p id="n-msg" className="mt-1.5 min-h-[19px] text-[13px] text-minus" role="alert">{asked && !nick ? "닉네임을 입력해주세요." : ""}</p>
            </div>
            <fieldset className="m-0 border-0 p-0">
              <legend className="lbl p-0">위치</legend>
              <div className="seg">
                {NAMES.map(([k, name]) => {
                  const p = PRESETS[k];
                  return (
                    <label key={k} className="gap-1.5 !py-2.5">
                      <input type="radio" name="p" value={k} defaultChecked={k === preset} />
                      {/* 1920x1080 화면에서 패널이 놓이는 자리 */}
                      <svg viewBox="0 0 1920 1080" className="block h-auto w-full max-w-[128px]" aria-hidden="true">
                        <rect x="8" y="8" width="1904" height="1064" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="16" />
                        <rect x={p.x0} y={p.y0} width={p.x1 - p.x0} height={p.y1 - p.y0} fill="currentColor" />
                      </svg>
                      {name}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="lbl" htmlFor="x">가로 이동 px</label>
                <input id="x" name="x" className="field num" type="number" inputMode="numeric" defaultValue={x} />
              </div>
              <div>
                <label className="lbl" htmlFor="y">세로 이동 px</label>
                <input id="y" name="y" className="field num" type="number" inputMode="numeric" defaultValue={y} />
              </div>
            </div>
            <button className="btn primary lg justify-self-start">주소 만들기</button>
          </form>
          {nick && (
            <div className="mt-8 max-w-[560px]">
              <CopyField key={url} label="오버레이 주소" value={url} />
              <dl className="mt-2 flex gap-3 text-[13px]">
                <dt className="text-ink-3">브라우저 소스 크기</dt>
                <dd className="m-0 font-semibold num">1920 x 1080</dd>
              </dl>
            </div>
          )}
        </section>
        <section className="sec self-start" aria-labelledby="t-h">
          <h2 id="t-h" className="sec-h">대회 오버레이</h2>
          <Link href="/next/er/score" className="mt-2 flex h-11 items-center border-y border-rule font-semibold hover:bg-row hover:no-underline">
            대회 점수
          </Link>
        </section>
      </div>
    </Shell>
  );
}
