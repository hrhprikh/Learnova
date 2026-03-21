"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Settings2 } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type AppRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type MeResponse = {
  user: {
    role: AppRole;
    email: string;
    fullName: string;
  } | null;
};

export default function BackofficeSettingsPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isResolvingRole, setIsResolvingRole] = useState(true);
  const [adminEmail, setAdminEmail] = useState("-");
  const [adminName, setAdminName] = useState("-");
  const [status, setStatus] = useState("Checking admin access...");

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const { data } = await getCurrentSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("No session token");

        const me = await apiRequest<MeResponse>("/users/me", { token });

        if (!active) return;
        setRole(me.user?.role ?? null);
        setIsResolvingRole(false);
        setAdminEmail(me.user?.email ?? "-");
        setAdminName(me.user?.fullName ?? "-");

        const adminProbe = await apiRequest<{ message: string }>("/protected/admin", { token });
        if (!active) return;
        setStatus(adminProbe.message);
      } catch (e) {
        if (!active) return;
        setIsResolvingRole(false);
        setStatus(e instanceof Error ? e.message : "Access denied");
      }
    }

    init();
    return () => {
      active = false;
    };
  }, []);

  return (
    <RoleGate role={role} isResolving={isResolvingRole} allow={["ADMIN"]}>
      <div className="min-h-screen bg-[var(--bg)] pb-20">
        <header className="px-6 py-5 lg:px-12 flex items-center justify-between border-b border-[var(--edge)] bg-white/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <Link href="/backoffice" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors font-mono text-sm group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Backoffice</span>
            </Link>
            <div className="h-4 w-px bg-[var(--edge)]" />
            <h1 className="font-heading text-xl">Admin Settings</h1>
          </div>
          <Settings2 className="w-5 h-5 text-[var(--ink-soft)]" />
        </header>

        <main className="max-w-4xl mx-auto mt-10 px-6">
          <section className="rounded-3xl border border-[var(--edge)] bg-white p-8 shadow-sm">
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="mono-note">admin control</p>
                <h2 className="font-heading text-2xl mt-2">System Access</h2>
              </div>
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--edge)] p-4 bg-gray-50/60">
                <p className="font-mono text-xs text-[var(--ink-soft)]">Current Admin</p>
                <p className="mt-2 text-sm font-semibold">{adminName}</p>
                <p className="font-mono text-xs mt-1 text-[var(--ink-soft)]">{adminEmail}</p>
              </div>
              <div className="rounded-2xl border border-[var(--edge)] p-4 bg-gray-50/60">
                <p className="font-mono text-xs text-[var(--ink-soft)]">Protection Probe</p>
                <p className="mt-2 text-sm font-semibold">{status}</p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </RoleGate>
  );
}
