import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import type { AccountUser } from "@/components/Account";
import Tips from "./Tips";

/** 운영 주소로 옮긴 개편 화면의 틀. 위쪽 메뉴는 옛 화면과 같은 SiteHeader를 씀 */
export default function Live({ user, children }: { user?: AccountUser | null; children: React.ReactNode }) {
  return (
    <>
      <SiteHeader user={user} />
      <Tips />
      <main id="main" className="mx-auto w-full max-w-[1320px] px-4 pt-5 pb-16 lg:px-6">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-[1320px] px-4 lg:px-6">
        <div className="flex gap-4 border-t border-rule py-5 text-[12px] text-ink-3">
          <Link href="/terms" className="tap">이용약관</Link>
          <Link href="/privacy" className="tap">개인정보 처리방침</Link>
        </div>
      </footer>
    </>
  );
}
