import Link from "next/link";

// 첫 화면 자료 카드의 세 칸 목록이 함께 쓰는 모양
export const line = "border-t border-line-soft py-2 first:border-t-0 first:pt-0";
export const row = "grid min-h-[36px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3";
export const go = "no-underline hover:text-fg";

// 칸마다 갈 곳이 같으면 href 없이 제목만 둠
export function Head({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <p className="mb-2 text-[13px] text-fg-3">{children}</p>;
  return (
    <Link className={`mb-2 inline-flex items-center gap-0.5 text-[13px] text-fg-3 ${go}`} href={href}>
      {children}
      <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
