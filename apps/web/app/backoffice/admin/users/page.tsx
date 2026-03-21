"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type AppRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type MeResponse = {
  user: {
    role: AppRole;
  } | null;
};

type UserRow = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  totalPoints: number;
  _count: {
    createdCourses: number;
    attendeeCourses: number;
  };
};

type UsersResponse = { users: UserRow[] };

export default function AdminUsersPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isResolvingRole, setIsResolvingRole] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const { data } = await getCurrentSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) throw new Error("No session token");
        const me = await apiRequest<MeResponse>("/users/me", { token: accessToken });
        if (!active) return;
        setRole(me.user?.role ?? null);
        setIsResolvingRole(false);
        setToken(accessToken);
      } catch (e) {
        if (!active) return;
        setIsResolvingRole(false);
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    apiRequest<UsersResponse>(`/admin/users${query}`, { token })
      .then((data) => setUsers(data.users))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"));
  }, [token, search]);

  async function updateRole(userId: string, nextRole: AppRole) {
    if (!token) return;
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: "PATCH",
        token,
        body: { role: nextRole }
      });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed updating role");
    }
  }

  return (
    <RoleGate role={role} isResolving={isResolvingRole} allow={["ADMIN"]}>
      <div className="min-h-screen bg-[var(--bg)] pb-20">
        <header className="px-6 py-5 lg:px-12 flex items-center justify-between border-b border-[var(--edge)] bg-white/50 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <Link href="/backoffice/admin" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] font-mono text-sm">
              <ArrowLeft className="w-4 h-4" />
              <span>Admin Hub</span>
            </Link>
            <div className="h-4 w-px bg-[var(--edge)]" />
            <h1 className="font-heading text-xl">Users Management</h1>
          </div>
        </header>

        <main className="max-w-7xl mx-auto mt-8 px-6">
          {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}

          <div className="relative min-w-[240px] max-w-lg mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-soft)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="w-full rounded-xl border border-[var(--edge)] bg-white pl-10 pr-4 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--edge)] bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--edge)] text-[var(--ink-soft)]">
                  <th className="px-4 py-3 font-mono text-xs">Name</th>
                  <th className="px-4 py-3 font-mono text-xs">Email</th>
                  <th className="px-4 py-3 font-mono text-xs">Role</th>
                  <th className="px-4 py-3 font-mono text-xs">Points</th>
                  <th className="px-4 py-3 font-mono text-xs">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--edge)]/40">
                    <td className="px-4 py-3 font-medium">{user.fullName}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(event) => updateRole(user.id, event.target.value as AppRole)}
                        className="rounded-lg border border-[var(--edge)] bg-white px-2 py-1 text-xs font-mono"
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="INSTRUCTOR">INSTRUCTOR</option>
                        <option value="LEARNER">LEARNER</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 font-mono">{user.totalPoints}</td>
                    <td className="px-4 py-3 font-mono text-xs">{user._count.createdCourses}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[var(--ink-soft)]">No users found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </RoleGate>
  );
}
