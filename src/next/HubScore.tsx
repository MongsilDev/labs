import Link from "next/link";
import CodeOpen from "./CodeOpen";
import RowLinks from "./RowLinks";
import type { Hub } from "./hub";

// 대회 점수 구역. 새 대회는 폼이 있는 /er/score로 보내고, ?create=1은 붙이지 않음(자동 생성 경로)
export default function HubScore({ mine }: { mine: Hub["mine"] }) {
  return (
    <section className="sec @container" aria-labelledby="hub-score-h">
      <h2 id="hub-score-h" className="sec-h">
        <Link href="/er/score">대회 점수</Link>
        <Link className="more" href="/er/example/a">예시 대회</Link>
      </h2>
      <div className="mt-3 grid gap-x-4 gap-y-3 @[330px]:grid-cols-[auto_minmax(0,1fr)] @[330px]:items-start">
        <Link className="btn primary justify-self-start @[330px]:mt-[22px]" href="/er/score">새 대회 만들기</Link>
        <CodeOpen />
      </div>
      {mine.length > 0 && <RowLinks className="mt-1" items={mine.map((m) => ({ href: `/er/t/${m.code}/a`, label: m.name, note: m.code }))} />}
    </section>
  );
}
