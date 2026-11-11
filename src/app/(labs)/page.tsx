import Link from "next/link";
import CutMini from "@/er/components/cut/CutMini";
import Live from "@/next/Live";
import HubScore from "@/next/HubScore";
import { CutNums, KelBig, OverlayOpen, TarkovGroup, TierBig } from "@/next/Hub5Parts";
import { KelHead, TierHead, TierMissing } from "@/next/HubParts";
import { hubData } from "@/next/hub";
import "@/next/hub.css";

export const dynamic = "force-dynamic";

// 위쪽 메뉴의 묶음(실험체, 랭크, 대회)대로 세 기둥에 이터널 리턴 기능 다섯을 같은 줄 높이로 두고 타르코프는 아래에 따로 묶음
export default async function Hub() {
  const h = await hubData();
  return (
    <Live user={h.user}>
      <div className="hub5 hub-lg">
        <div className="hub5-col hub-in">
          <section>
            <TierHead h={h} />
            {h.view ? <TierBig list={h.combos.slice(0, 7)} /> : <TierMissing />}
          </section>
        </div>
        <div className="hub5-col hub-in" style={{ ["--d" as string]: 1 }}>
          <section className="hub5-cut">
            <h2 className="sec-h">
              <Link href="/er/cut">이터컷</Link>
              {h.cut && <small>{h.cut.season.name}</small>}
              <Link className="more" href="/er/cut">내 RP 진단</Link>
            </h2>
            {h.cut ? (
              <>
                <CutNums cut={h.cut} />
                <CutMini data={h.cut} />
              </>
            ) : (
              <p className="py-3 text-ink-3">이터컷을 불러오지 못했습니다.</p>
            )}
          </section>
          <section>
            <h2 className="sec-h">
              <Link href="/er/overlay">오버레이</Link>
            </h2>
            <OverlayOpen />
          </section>
        </div>
        <div className="hub5-col hub-in" style={{ ["--d" as string]: 2 }}>
          <section>
            <KelHead h={h} />
            <KelBig h={h} />
          </section>
          <HubScore mine={h.mine} />
        </div>
      </div>
      <TarkovGroup className="hub-lg hub-in" />
    </Live>
  );
}
