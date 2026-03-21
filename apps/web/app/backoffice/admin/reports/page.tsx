"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type AppRole = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type MeResponse = {
  user: {
    role: AppRole;
  } | null;
};

type ReportRow = {
  srNo: number;
  courseName: string;
  participantName: string;
  participantEmail: string;
  enrolledAt: string | null;
  completionPercent: number;
  status: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
};

type AdminReportResponse = {
  overview: {
    totalParticipants: number;
    yetToStart: number;
    inProgress: number;
    completed: number;
  };
  rows: ReportRow[];
};

export default function AdminReportsPage() {
  const [role, setRole] = useState<AppRole | null>(null);
  const [isResolvingRole, setIsResolvingRole] = useState(true);
  const [report, setReport] = useState<AdminReportResponse | null>(null);
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

        const reportData = await apiRequest<AdminReportResponse>("/admin/reports/course-progress", {
          token: accessToken
        });

        if (!active) return;
        setReport(reportData);
      } catch (e) {
        if (!active) return;
        setIsResolvingRole(false);
        setError(e instanceof Error ? e.message : "Failed to load report");
      }
    }
    init();
    return () => {
      active = false;
    };
  }, []);

  function exportCsv() {
    if (!report?.rows.length) return;

    const header = ["Sr", "Course", "Participant", "Email", "Enrolled", "Completion %", "Status"];
    const lines = report.rows.map((row) => [
      row.srNo,
      row.courseName,
      row.participantName,
      row.participantEmail,
      row.enrolledAt ?? "",
      row.completionPercent,
      row.status
    ]);

    const csv = [header, ...lines]
      .map((line) => line.map((item) => `"${String(item).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "admin-global-report.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
            <h1 className="font-heading text-xl">Global Reports</h1>
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-[var(--edge)] px-3 py-2 text-xs font-mono hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </header>

        <main className="max-w-7xl mx-auto mt-8 px-6">
          {error ? <p className="text-sm text-red-600 mb-4">{error}</p> : null}

          <div className="grid gap-3 md:grid-cols-4 mb-6">
            <article className="rounded-xl border border-[var(--edge)] bg-white p-4"><p className="font-mono text-xs">Total</p><p className="font-heading text-2xl mt-2">{report?.overview.totalParticipants ?? 0}</p></article>
            <article className="rounded-xl border border-[var(--edge)] bg-white p-4"><p className="font-mono text-xs">Yet To Start</p><p className="font-heading text-2xl mt-2">{report?.overview.yetToStart ?? 0}</p></article>
            <article className="rounded-xl border border-[var(--edge)] bg-white p-4"><p className="font-mono text-xs">In Progress</p><p className="font-heading text-2xl mt-2">{report?.overview.inProgress ?? 0}</p></article>
            <article className="rounded-xl border border-[var(--edge)] bg-white p-4"><p className="font-mono text-xs">Completed</p><p className="font-heading text-2xl mt-2">{report?.overview.completed ?? 0}</p></article>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[var(--edge)] bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-[var(--edge)] text-[var(--ink-soft)]">
                  <th className="px-4 py-3 font-mono text-xs">Sr</th>
                  <th className="px-4 py-3 font-mono text-xs">Course</th>
                  <th className="px-4 py-3 font-mono text-xs">Participant</th>
                  <th className="px-4 py-3 font-mono text-xs">Email</th>
                  <th className="px-4 py-3 font-mono text-xs">Enrolled</th>
                  <th className="px-4 py-3 font-mono text-xs">Completion</th>
                  <th className="px-4 py-3 font-mono text-xs">Status</th>
                </tr>
              </thead>
              <tbody>
                {report?.rows.map((row) => (
                  <tr key={`${row.srNo}-${row.participantEmail}`} className="border-b border-[var(--edge)]/40">
                    <td className="px-4 py-3 font-mono text-xs">{row.srNo}</td>
                    <td className="px-4 py-3">{row.courseName}</td>
                    <td className="px-4 py-3">{row.participantName}</td>
                    <td className="px-4 py-3">{row.participantEmail}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.enrolledAt ? new Date(row.enrolledAt).toLocaleDateString() : "-"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.completionPercent}%</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.status}</td>
                  </tr>
                ))}
                {!report?.rows?.length ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--ink-soft)]">No report rows found.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </RoleGate>
  );
}
