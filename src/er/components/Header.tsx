import SiteHeader from "@/components/SiteHeader";
import { avatarUrl, type User } from "@/er/server/auth";

export default function Header({
  user,
  crumb,
  crumbHref = "/er/score",
  right,
}: {
  user: User | null;
  crumb?: string;
  crumbHref?: string;
  right?: React.ReactNode;
}) {
  return (
    <SiteHeader crumb={crumb ? { href: crumbHref, label: crumb } : undefined} user={user ? { name: user.name, avatar: avatarUrl(user) } : null}>
      {right}
    </SiteHeader>
  );
}
