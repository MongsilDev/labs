import Link from "next/link";
import Account, { type AccountUser } from "./Account";
import { MarkSvg } from "./SiteMark";
import ThemeToggle from "./ThemeToggle";
import "./site.css";

export default function SiteHeader({
  crumb,
  user,
  children,
}: {
  crumb?: { href: string; label: string };
  user?: AccountUser | null;
  children?: React.ReactNode;
}) {
  return (
    <header className="site-top">
      <a className="site-skip" href="#main">
        본문으로 건너뛰기
      </a>
      <div className="site-top-in">
        <Link className="site-mark" href="/">
          <MarkSvg />
          Labs
        </Link>
        {crumb && (
          <Link className="site-crumb" href={crumb.href}>
            {crumb.label}
          </Link>
        )}
        <div className="site-right">
          {children}
          <Account user={user} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
