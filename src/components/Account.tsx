"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { here } from "./here";
import UserMenu from "./UserMenu";

export type AccountUser = { name: string; avatar: string | null };

const loginHref = (path: string, search?: string) => `/auth/login?next=${encodeURIComponent(here(path, search))}`;

// user를 받지 않은 화면은 서버에서 쿠키를 읽지 않도록 /api/me로 확인. 확인 전에는 자리만 잡음
export default function Account({ user }: { user?: AccountUser | null }) {
  const [fetched, setFetched] = useState<AccountUser | null>();
  const path = usePathname();
  useEffect(() => {
    if (user !== undefined) return;
    let live = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: AccountUser | null } | null) => live && setFetched(d?.user ? { name: d.user.name, avatar: d.user.avatar } : null))
      .catch(() => live && setFetched(null));
    return () => {
      live = false;
    };
  }, [user]);
  const me = user !== undefined ? user : fetched;
  if (me) return <UserMenu name={me.name} avatar={me.avatar} />;
  return (
    <a
      className="btn sm site-login"
      style={me === undefined ? { visibility: "hidden" } : undefined}
      href={loginHref(path)}
      onClick={(e) => {
        e.currentTarget.href = loginHref(location.pathname, location.search);
      }}
    >
      로그인
    </a>
  );
}
