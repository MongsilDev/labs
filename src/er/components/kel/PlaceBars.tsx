import { TONES } from "@/er/lib/kel";

// 1위부터 순위마다 게임 수 막대, 1위만 진하게
export default function PlaceBars({ counts }: { counts: number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <ol className="mt-4 grid grid-cols-8 items-end gap-3 max-[760px]:gap-1.5">
      {counts.map((n, i) => (
        <li key={i} className="grid justify-items-center gap-1.5 text-[13px]">
          <b className="text-[15px]">{n}</b>
          <span className="w-full max-w-[72px] rounded-t-[4px]" style={{ height: Math.max(2, (n / max) * 140), background: TONES[0], opacity: i === 0 ? 1 : 0.45 }} aria-hidden="true" />
          <span className="text-fg-3">{i + 1}위</span>
        </li>
      ))}
    </ol>
  );
}
