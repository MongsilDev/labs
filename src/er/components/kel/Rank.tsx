// 모수는 흐리게 두고 순위 숫자를 키움
export default function Rank({ pool, rank, unit }: { pool: number; rank: number; unit: string }) {
  return (
    <dd className="mt-0.5 text-[13px] text-fg-3">
      {pool}
      {unit} 중 <b className="text-[16px] font-extrabold text-accent-text">{rank}위</b>
    </dd>
  );
}
