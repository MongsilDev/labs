import { notFound } from "next/navigation";
import { avatarUrl } from "@/er/server/auth";
import { l10nDiff, l10nGate, unescape, versionLabel } from "@/next/l10n";
import Live from "@/next/Live";
import { wordDiff } from "@/next/l10n-words";

export const dynamic = "force-dynamic";
export const metadata = { title: "l10n 변경", robots: { index: false, follow: false } };

const VALUE = "mt-1 text-[14px] leading-relaxed whitespace-pre-wrap wrap-anywhere";
const OLD = `${VALUE} text-ink-3 line-through`;

// 색만으로 구분하지 않게 지운 글은 취소선, 더한 글은 밑줄을 함께 씀
const DEL = { color: "var(--down)", background: "color-mix(in srgb, var(--down) 16%, transparent)" };
const INS = { color: "var(--up)", background: "color-mix(in srgb, var(--up) 16%, transparent)" };
const MARK = "rounded-sm px-0.5 decoration-2";

type Row = { k: string; old?: string; value?: string; diff?: [string, string] };

function Changed({ a, b }: { a: string; b: string }) {
  return (
    <div className={VALUE}>
      {wordDiff(unescape(a), unescape(b)).map((p, i) =>
        p.op < 0 ? (
          <del key={i} className={`${MARK} line-through`} style={DEL}>
            {p.text}
          </del>
        ) : p.op > 0 ? (
          <ins key={i} className={`${MARK} underline underline-offset-3`} style={INS}>
            {p.text}
          </ins>
        ) : (
          p.text
        ),
      )}
    </div>
  );
}

function Rows({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  return (
    <section className="sec mt-8">
      <h2 className="sec-h">
        {title}
        <small className="num">{rows.length.toLocaleString("ko-KR")}개</small>
      </h2>
      <div className="mt-1">
        {rows.map((r) => (
          <div key={r.k} className="border-b border-rule py-2.5">
            {/* 키 자리에 한국어 문장이 든 줄이 있어 값과 구분되게 코드로 표시 */}
            <code className="inline-block max-w-full rounded-sm border border-rule bg-(--row) px-1.5 py-px font-mono text-[12px] wrap-anywhere text-ink-2">{r.k}</code>
            {r.diff && <Changed a={r.diff[0]} b={r.diff[1]} />}
            {r.old !== undefined && <div className={OLD}>{unescape(r.old)}</div>}
            {r.value !== undefined && <div className={VALUE}>{unescape(r.value)}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function L10nDiffPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await l10nGate();
  const { id } = await params;
  const d = await l10nDiff(id);
  if (!d) notFound();
  const changed = Object.entries(d.changed);
  const added = Object.entries(d.added);
  const removed = Object.entries(d.removed);
  return (
    <Live user={{ name: me.name, avatar: avatarUrl(me) }}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="num text-[26px] leading-tight font-black tracking-[-0.5px]">{versionLabel(d.id)}</h1>
        <p className="num text-[13px] text-ink-3">{versionLabel(d.from)} 판과 비교</p>
      </div>
      {changed.length + added.length + removed.length === 0 && <p className="mt-6 text-ink-3">차이 없음</p>}
      <Rows title="변경" rows={changed.map(([k, diff]) => ({ k, diff }))} />
      <Rows title="추가" rows={added.map(([k, value]) => ({ k, value }))} />
      <Rows title="삭제" rows={removed.map(([k, old]) => ({ k, old }))} />
    </Live>
  );
}
