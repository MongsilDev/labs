import Link from "next/link";
import Lines from "@/components/Lines";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import { DAKGG, KEL_SCREENS, KEL_SECTIONS, kelVisible, type KelScreen } from "@/er/lib/kel";
import type { User } from "@/er/server/auth";

type Text = string | (string | false | null | undefined)[];
type Tab<K extends string> = readonly [K, React.ReactNode];

const join = (t?: Text) => (Array.isArray(t) ? t.filter(Boolean).join(" ") : (t ?? ""));

export const NO_DATA = "경기 기록 CSV를 찾지 못했습니다. CSV를 서버 데이터 폴더의 kel 폴더에 넣어주세요.";
export const NO_DAK = "dak.gg 경기 상세를 찾지 못했습니다. 경기 상세 파일을 서버 데이터 폴더의 kel/dakgg 폴더에 넣어주세요.";

export const pickTab = <K extends string>(items: readonly Tab<K>[], value?: string): K => (items.find(([k]) => k === value) ?? items[0])[0];

export { default as KelScroll } from "./KelScroll";

type TabsProps<K extends string> = { label: string; items: readonly Tab<K>[]; current: K } & ({ screen: KelScreen; param: string } | { href: (k: K) => string });

// screen과 param을 주면 첫 탭은 화면 주소, 나머지는 ?param=값
export function KelTabs<K extends string>(props: TabsProps<K>) {
  const { label, items, current } = props;
  const href = (k: K, i: number) => {
    if ("href" in props) return props.href(k);
    const path = KEL_SCREENS[props.screen].path;
    return i === 0 ? path : `${path}?${props.param}=${k}`;
  };
  return (
    <nav className="tabs" aria-label={label}>
      {items.map(([k, name], i) => (
        <Link key={k} href={href(k, i)} aria-current={k === current ? "page" : undefined}>
          {name}
        </Link>
      ))}
    </nav>
  );
}

export default function KelPage({
  user,
  owner,
  screen,
  lead,
  notes = [],
  children,
}: {
  user: User | null;
  owner: boolean;
  screen: KelScreen;
  lead?: Text;
  notes?: Text;
  children?: React.ReactNode;
}) {
  const s = KEL_SCREENS[screen];
  const intro = join(lead);
  const note = join(notes);
  const section = KEL_SECTIONS.find((g) => g.items.includes(screen));
  const siblings = section?.items.filter((k) => k !== screen && kelVisible(k, owner)) ?? [];
  return (
    <>
      <Header user={user} crumb="KEL 기록" crumbHref={KEL_SCREENS.home.path} next={s.path} />
      <main id="main" className="wrap grid grid-cols-1 content-start gap-5 pt-6">
        <div>
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[28px] font-extrabold tracking-[-0.5px] max-[760px]:text-[24px]">
            {s.title}
            {owner && !s.public && <span className="chip">나만 보기</span>}
          </h1>
          {intro && (
            <p className="mt-2 max-w-[720px] text-fg-2">
              <Lines text={intro} />
            </p>
          )}
        </div>
        {children}
        {note && (
          <p className="text-[13px] leading-relaxed text-fg-3">
            <Lines text={note} />
          </p>
        )}
        {screen === "home" && (
          <p className="text-[13px] leading-relaxed text-fg-3">
            출처: 님블뉴런 이스포츠 팀 제공 경기 기록,{" "}
            <a className="decoration-line-strong underline-offset-[3px] hover:decoration-fg-3" href={DAKGG}>
              dak.gg e스포츠 경기 기록
            </a>
            , bori.wiki 대회 결과, 2026 KEL 경기 규정 10월 12일 시행판
            <br />
            팀 로고의 저작권은 각 구단에 있습니다.
          </p>
        )}
        {section && siblings.length > 0 && (
          <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label={section.title}>
            {siblings.map((k) => (
              <Link key={k} className="group font-bold no-underline" href={KEL_SCREENS[k].path}>
                {KEL_SCREENS[k].title}
                <svg className="ml-0.5 inline-block size-4 align-[-2px] text-fg-3 group-hover:text-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            ))}
          </nav>
        )}
      </main>
      <Footer />
    </>
  );
}
