import Link from "next/link";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap slim">
        <section className="panel mt-6 grid justify-items-start gap-2.5 p-7">
          <h1 className="text-[22px]">없는 페이지입니다</h1>
          <Link className="btn primary" href="/">
            Labs로 이동
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
