import Link from "next/link";
import Lines from "@/components/Lines";
import Footer from "@/components/SiteFooter";
import Header from "@/er/components/Header";
import { DAKGG, KEL_SCREENS, KEL_SECTIONS, kelVisible, RULES, wikiUrl, type KelScreen } from "@/er/lib/kel";
import type { User } from "@/er/server/auth";

type Text = string | (string | false | null | undefined)[];
type Tab<K extends string> = readonly [K, React.ReactNode];

const SOURCE_LINK = "whitespace-nowrap decoration-line-strong underline-offset-[3px] hover:decoration-fg-3";

const join = (t?: Text) => (Array.isArray(t) ? t.filter(Boolean).join(" ") : (t ?? ""));

// 자료가 없을 때 방문자 문장과 소유자에게만 덧붙이는 파일 안내
export type Missing = readonly [string, string];
export const NO_DATA: Missing = ["경기 기록을 불러오지 못했습니다.", "경기 기록 CSV를 서버 데이터 폴더의 kel 폴더에 넣어주세요."];
export const NO_DAK: Missing = ["dak.gg 경기 상세를 불러오지 못했습니다.", "경기 상세 파일을 서버 데이터 폴더의 kel/dakgg 폴더에 넣어주세요."];

export const pickTab = <K extends string>(items: readonly Tab<K>[], value?: string): K => (items.find(([k]) => k === value) ?? items[0])[0];

export { default as KelScroll } from "./KelScroll";

type TabsProps<K extends string> = { label: string; items: readonly Tab<K>[]; current: K; className?: string } & ({ screen: KelScreen; param: string } | { href: (k: K) => string });

// screen과 param을 주면 첫 탭은 화면 주소, 나머지는 ?param=값
export function KelTabs<K extends string>(props: TabsProps<K>) {
  const { label, items, current } = props;
  const href = (k: K, i: number) => {
    if ("href" in props) return props.href(k);
    const path = KEL_SCREENS[props.screen].path;
    return i === 0 ? path : `${path}?${props.param}=${k}`;
  };
  return (
    <nav className={`tabs ${props.className ?? ""}`} aria-label={label}>
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
  missing,
  notes = [],
  children,
}: {
  user: User | null;
  owner: boolean;
  screen: KelScreen;
  lead?: Text;
  missing?: Missing;
  notes?: Text;
  children?: React.ReactNode;
}) {
  const s = KEL_SCREENS[screen];
  const intro = missing ? join(owner ? [...missing] : [missing[0]]) : join(lead);
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
            <a className={SOURCE_LINK} href={DAKGG}>
              dak.gg e스포츠 경기 기록
            </a>
            ,{" "}
            <a className={SOURCE_LINK} href={wikiUrl("2026 Korean Esports League")}>
              bori.wiki 대회 결과
            </a>
            ,{" "}
            <a className={SOURCE_LINK} href={RULES}>
              2026 KEL 경기 규정 10월 12일 시행판
            </a>
            <br />
            팀 로고의 저작권은 각 구단에 있습니다.
            <br />
            부진한 기록을 포함한 모든 기록은 경기 결과를 정리한 자료이며, 선수나 팀을 평가하거나 비방하려는 목적으로 만들지 않았습니다.
            <br />
            특정 선수나 팀을 비방하는 근거로 해석하거나 활용하지 말아주세요.
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
