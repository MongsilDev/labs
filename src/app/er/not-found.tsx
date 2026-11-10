import Link from "next/link";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import { currentUser } from "@/er/server/auth";

export default async function NotFound() {
  const user = await currentUser();
  return (
    <>
      <Header user={user} />
      <main id="main" className="wrap slim">
      <section className="panel mt-6 grid justify-items-start gap-2.5 p-7">
        <h1 className="text-[22px]">없는 페이지이거나 지워진 대회입니다</h1>
        <p className="text-fg-3">대회는 마지막으로 수정하고 24시간이 지나면 자동으로 삭제됩니다.</p>
        <Link className="btn primary" href="/er/score">
          대회 점수로 이동
        </Link>
      </section>
    </main>
      <Footer />
    </>
  );
}
