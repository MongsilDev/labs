import Link from "next/link";
import { avatarUrl } from "@/er/server/auth";
import { l10nGate, l10nIndex, versionLabel, type L10nVersion } from "@/next/l10n";
import Live from "@/next/Live";

export const dynamic = "force-dynamic";
export const metadata = { title: "l10n", robots: { index: false, follow: false } };

// 판 이름(versionLabel)과 같은 YYYY-MM-DD HH:mm
const time = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function counts(v: L10nVersion): string[] {
  if (!v.from) return [];
  const parts = (
    [
      ["변경", v.changed],
      ["추가", v.added],
      ["삭제", v.removed],
    ] as const
  )
    .filter(([, n]) => n)
    .map(([k, n]) => `${k} ${n!.toLocaleString("ko-KR")}`);
  return parts.length ? parts : ["차이 없음"];
}

export default async function L10nPage() {
  const me = await l10nGate();
  const { versions, checked } = await l10nIndex();
  return (
    <Live user={{ name: me.name, avatar: avatarUrl(me) }}>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h1 className="text-[26px] leading-tight font-black tracking-[-0.5px]">l10n</h1>
        {checked && <p className="num text-[13px] text-ink-3">{time.format(new Date(checked))} 확인</p>}
      </div>
      {versions.length ? (
        <table className="tbl mt-6">
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="l font-semibold">{v.from ? <Link href={`/er/l10n/${v.id}`}>{versionLabel(v.id)}</Link> : versionLabel(v.id)}</td>
                <td className="text-[13px] text-ink-2">
                  <span className="inline-flex gap-3">
                    {counts(v).map((c) => (
                      <span key={c}>{c}</span>
                    ))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-6 text-ink-3" role="status">
          받은 판이 없습니다.
        </p>
      )}
    </Live>
  );
}
