"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Users, BookOpen, GraduationCap, Activity } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type AppRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type MeResponse = {
  user: {
    role: AppRole;
  } | null;
};

type AdminOverviewResponse = {
  overview: {
    totalUsers: number;
    totalCourses: number;
    publishedCourses: number;
    totalEnrollments: number;
    yetToStart: number;
    inProgress: number;
    completed: number;
    averageCompletionPercent: number;
  };
};

export default function AdminHubPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isResolvingRole, setIsResolvingRole] = useState(true);
  const [overview, setOverview] = useState<AdminOverviewResponse["overview"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data } = await getCurrentSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("No session token");

        const me = await apiRequest<MeResponse>("/users/me", { token });
        if (!active) return;

        setRole(me.user?.role ?? null);
        setIsResolvingRole(false);

        const summary = await apiRequest<AdminOverviewResponse>("/admin/overview", { token });

        if (!active) return;
        setOverview(summary.overview);
      } catch (e) {
        if (!active) return;
        setIsResolvingRole(false);
        setError(e instanceof Error ? e.message : "Failed to load admin hub");
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const cards = [
    { title: "Users", value: overview?.totalUsers ?? 0, icon: <Users className="w-5 h-5" /> },
    { title: "Courses", value: overview?.totalCourses ?? 0, icon: <BookOpen className="w-5 h-5" /> },
    { title: "Enrollments", value: overview?.totalEnrollments ?? 0, icon: <GraduationCap className="w-5 h-5" /> },
    { title: "Avg Progress", value: `${overview?.averageCompletionPercent ?? 0}%`, icon: <Activity className="w-5 h-5" /> }
  ];

  return (
    <RoleGate role={role} isResolving={isResolvingRole} allow={["ADMIN"]}>
      <div className="min-h-screen bg-[var(--bg)] pb-20">
        <header className="px-6 py-5 lg:px-12 flex items-center justify-between border-b border-[var(--edge)] bg-white/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <Link href="/backoffice" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] font-mono text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span>Backoffice</span>
            </Link>
            <div className="h-4 w-px bg-[var(--edge)]" />
            <h1 className="font-heading text-xl">Admin Hub</h1>
          </div>
          <nav className="flex items-center gap-4 font-mono text-xs">
            <Link href="/backoffice/admin/users" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">Users</Link>
            <Link href="/backoffice/admin/reports" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">Global Reports</Link>
          </nav>
        </header>

        <main className="max-w-6xl mx-auto mt-10 px-6">
          {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <article key={card.title} className="rounded-2xl border border-[var(--edge)] bg-white p-5">
                <div className="flex items-center justify-between text-[var(--ink-soft)]">
                  <p className="font-mono text-xs uppercase tracking-wide">{card.title}</p>
                  {card.icon}
                </div>
                <p className="mt-4 font-heading text-3xl">{card.value}</p>
              </article>
            ))}
          </div>
        </main>
      </div>
    </RoleGate>
  );
}
