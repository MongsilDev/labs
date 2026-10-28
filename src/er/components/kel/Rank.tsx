// 순위를 앞에 크게, 전체 수는 뒤에 작고 흐리게. 낭독기는 "61명 중 6위"로 읽음
export default function Rank({ pool, rank, unit }: { pool: number; rank: number; unit: string }) {
  return (
    <dd className="mt-0.5">
      <span className="sr-only">{`${pool}${unit} 중 ${rank}위`}</span>
      <span aria-hidden="true">
        <b className="text-[16px] font-extrabold text-accent-text">{rank}위</b>{" "}
        <span className="text-[12px] text-fg-3">/ {`${pool}${unit}`}</span>
      </span>
    </dd>
  );
}
