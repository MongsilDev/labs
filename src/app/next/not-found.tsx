import Link from "next/link";
import Shell from "@/next/Shell";

const GO = [
  ["/next/er/tier", "실험체 티어"],
  ["/next/er/cut", "이터컷"],
  ["/next/er/score", "대회 점수"],
  ["/next/tarkov/players", "계정 조회"],
] as const;

export default function NextNotFound() {
  return (
    <Shell>
      <div className="max-w-[560px] border-t-2 border-ink pt-4">
        <h1 className="text-[22px] font-black">없는 페이지이거나 지워진 대회입니다.</h1>
        <ul className="mt-6 grid">
          {GO.map(([href, label]) => (
            <li key={href} className="border-b border-rule">
              <Link href={href} className="flex h-11 items-center font-semibold hover:bg-row hover:no-underline">{label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}
