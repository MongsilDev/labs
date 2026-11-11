import Link from "next/link";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import { KEL_SCREENS } from "@/er/lib/kel";
import { currentUser } from "@/er/server/auth";

export default async function NotFound() {
  const user = await currentUser();
  return (
    <>
      <Header user={user} />
      <main id="main" className="wrap slim">
        <section className="mt-6 grid justify-items-start gap-2.5 py-7">
          <h1 className="text-[22px]">없는 페이지입니다</h1>
          <Link className="btn primary" href={KEL_SCREENS.home.path}>
            KEL 기록으로 이동
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
