"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type TopNavProps = {
  roleLabel?: string;
};

type Role = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type MeResponse = {
  user: {
    role: Role;
  } | null;
};

export function TopNav({ roleLabel }: TopNavProps) {
  const [resolvedRole, setResolvedRole] = useState<Role | null>(null);

  useEffect(() => {
    let active = true;

    async function resolveRole() {
      try {
        const { data } = await getCurrentSession();
        const token = data.session?.access_token;
        if (!token) {
          if (active) setResolvedRole(null);
          return;
        }

        const me = await apiRequest<MeResponse>("/users/me", { token });
        if (active) {
          setResolvedRole(me.user?.role ?? null);
        }
      } catch {
        if (active) {
          setResolvedRole(null);
        }
      }
    }

    resolveRole();

    return () => {
      active = false;
    };
  }, []);

  const links = useMemo(() => {
    if (resolvedRole === "ADMIN" || resolvedRole === "INSTRUCTOR") {
      return [
        { href: "/backoffice", label: "Backoffice" },
        { href: "/courses", label: "Courses" },
        { href: "/dashboard", label: "Dashboard" }
      ];
    }

    if (resolvedRole === "LEARNER") {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/courses", label: "Courses" }
      ];
    }

    return [
      { href: "/courses", label: "Courses" },
      { href: "/login", label: "Login" },
      { href: "/register", label: "Register" }
    ];
  }, [resolvedRole]);

  const badge = roleLabel ?? (resolvedRole ? resolvedRole.toLowerCase() : "guest");

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 pt-8">
      <Link href="/" className="brand-mark">
        Learnova
      </Link>
      <nav className="floating-strip">
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="floating-link">{link.label}</Link>
        ))}
      </nav>
      <span className="mono-tag">{badge}</span>
    </header>
  );
}
