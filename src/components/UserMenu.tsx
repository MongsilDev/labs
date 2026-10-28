"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/er/components/Avatar";

export default function UserMenu({ name, avatar }: { name: string; avatar: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  return (
    <div className="site-user" ref={ref}>
      <button type="button" className="site-user-btn" aria-label={name} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Avatar name={name} src={avatar} />
        <span className="site-user-name">{name}</span>
      </button>
      {open && (
        <div className="site-pop" role="menu">
          <Link role="menuitem" href="/er/score">내 대회</Link>
          <form method="post" action="/auth/logout">
            <button role="menuitem" type="submit">로그아웃</button>
          </form>
        </div>
      )}
    </div>
  );
}
