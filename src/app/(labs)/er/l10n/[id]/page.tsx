import { notFound } from "next/navigation";
import { avatarUrl } from "@/er/server/auth";
import { l10nDiff, l10nGate, unescape, versionLabel } from "@/next/l10n";
import Live from "@/next/Live";

export const dynamic = "force-dynamic";
export const metadata = { title: "l10n 변경", robots: { index: false, follow: false } };

const VALUE = "mt-1 text-[14px] leading-relaxed whitespace-pre-wrap wrap-anywhere";
const OLD = `${VALUE} text-ink-3 line-through`;

type Row = { k: string; old?: string; value?: string };

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
            <div className="font-mono text-[12px] wrap-anywhere text-ink-3">{r.k}</div>
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
      <Rows title="변경" rows={changed.map(([k, [old, value]]) => ({ k, old, value }))} />
      <Rows title="추가" rows={added.map(([k, value]) => ({ k, value }))} />
      <Rows title="삭제" rows={removed.map(([k, old]) => ({ k, old }))} />
    </Live>
  );
}
