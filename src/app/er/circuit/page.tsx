import type { Metadata } from "next";
import Footer from "@/components/SiteFooter";
import CircuitCalc from "@/er/components/circuit/CircuitCalc";
import Header from "@/er/components/Header";
import { currentUser } from "@/er/server/auth";

export const metadata: Metadata = {
  title: "서킷 진출 확률 계산",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function CircuitPage() {
  const user = await currentUser();
  return (
    <>
      <Header user={user} crumb="서킷 진출 확률" crumbHref="/er/circuit" />
      <main id="main" className="wrap">
        <h1 className="mt-3 mb-[18px] text-[28px] font-extrabold tracking-[-0.5px]">서킷 진출 확률 계산</h1>
        <CircuitCalc />
      </main>
      <Footer />
    </>
  );
}
