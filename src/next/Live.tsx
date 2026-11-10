import SiteHeader from "@/components/SiteHeader";
import type { AccountUser } from "@/components/Account";
import { Foot } from "./Shell";

/** 운영 주소로 옮긴 개편 화면의 틀. 위쪽 메뉴는 옛 화면과 같은 SiteHeader를 씀 */
export default function Live({ user, children }: { user?: AccountUser | null; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader user={user} />
      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-16 lg:px-6">
        {children}
      </main>
      <Foot />
    </>
  );
}
