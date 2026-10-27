import SiteHeader from "@/components/SiteHeader";
import { avatarUrl, type User } from "@/er/server/auth";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";

export default function Header({
  user,
  crumb,
  crumbHref = "/er/score",
  wide,
  right,
  login = true,
  next,
}: {
  user: User | null;
  crumb?: string;
  crumbHref?: string;
  wide?: boolean;
  right?: React.ReactNode;
  login?: boolean;
  next?: string;
}) {
  return (
    <SiteHeader crumb={crumb ? { href: crumbHref, label: crumb } : undefined} wide={wide}>
      {right}
      {user ? (
        <UserMenu name={user.name} avatar={avatarUrl(user)} />
      ) : login ? (
        <a className="btn sm h-9" href={`/auth/login?next=${encodeURIComponent(next ?? "/er/score")}`}>
          로그인
        </a>
      ) : null}
      <ThemeToggle />
    </SiteHeader>
  );
}
