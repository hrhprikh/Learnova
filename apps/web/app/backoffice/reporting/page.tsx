"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Users, Clock, CheckCircle2, PlayCircle, Filter, Columns } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type CourseItem = { id: string; title: string };

type ReportRow = {
    participantName: string;
    participantEmail: string;
    enrolledAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    timeSpentSeconds: number;
    completedLessons: number;
    totalLessons: number;
    completionPercent: number;
    status: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
};

type ReportResponse = {
    overview: {
        totalParticipants: number;
        yetToStart: number;
        inProgress: number;
        completed: number;
    };
    rows: ReportRow[];
};

const ALL_COLUMNS = [
    { key: "sr", label: "Sr No." },
    { key: "name", label: "Participant" },
    { key: "email", label: "Email" },
    { key: "enrolledAt", label: "Enrolled" },
    { key: "startedAt", label: "Started" },
    { key: "completedAt", label: "Finished" },
    { key: "timeSpent", label: "Time Spent" },
    { key: "completedLessons", label: "Lessons Done" },
    { key: "totalLessons", label: "Total Lessons" },
    { key: "completionPercent", label: "Completion %" },
    { key: "status", label: "Status" },
] as const;

function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString();
}

type ColumnKey = (typeof ALL_COLUMNS)[number]["key"];

export default function ReportingPage() {
    const [token, setToken] = useState<string | null>(null);
    const [courses, setCourses] = useState<CourseItem[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<string>("");
    const [report, setReport] = useState<ReportResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showColumnPanel, setShowColumnPanel] = useState(false);
    const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(
        new Set(ALL_COLUMNS.map(c => c.key))
    );

    const searchParams = useSearchParams();
    const courseIdParam = searchParams.get("courseId");

    useEffect(() => {
        async function init() {
            const { data } = await getCurrentSession();
            const t = data.session?.access_token;
            if (!t) return;
            setToken(t);
            const res = await apiRequest<{ courses: CourseItem[] }>("/courses?mine=true", { token: t });
            setCourses(res.courses);
            
            if (courseIdParam && res.courses.some(c => c.id === courseIdParam)) {
                setSelectedCourse(courseIdParam);
            } else if (res.courses.length > 0 && res.courses[0]) {
                setSelectedCourse(res.courses[0].id);
            }
        }
        init().catch(() => setError("Failed to load courses"));
    }, [courseIdParam]);

    useEffect(() => {
        if (!token || !selectedCourse) return;
        setIsLoading(true);
        setReport(null);
        setStatusFilter(null);
        apiRequest<ReportResponse>(`/reports/course-progress?courseId=${selectedCourse}`, { token })
            .then(r => setReport(r))
            .catch(() => setError("Failed to load report"))
            .finally(() => setIsLoading(false));
    }, [token, selectedCourse]);

    const filteredRows = report
        ? statusFilter
            ? report.rows.filter(r => r.status === statusFilter)
            : report.rows
        : [];

    function toggleCol(key: ColumnKey) {
        setVisibleCols(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    const statusBadge = (s: string) => {
        if (s === "COMPLETED") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-mono"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
        if (s === "IN_PROGRESS") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-mono"><PlayCircle className="w-3 h-3" /> In Progress</span>;
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-mono"><Clock className="w-3 h-3" /> Yet to Start</span>;
    };

    const overviewCards = [
        { label: "Total Participants", value: report?.overview.totalParticipants ?? 0, filter: null, icon: <Users className="w-5 h-5" />, color: "bg-[var(--ink)] text-white" },
        { label: "Yet to Start", value: report?.overview.yetToStart ?? 0, filter: "YET_TO_START", icon: <Clock className="w-5 h-5" />, color: "bg-gray-50 text-[var(--ink)]" },
        { label: "In Progress", value: report?.overview.inProgress ?? 0, filter: "IN_PROGRESS", icon: <PlayCircle className="w-5 h-5" />, color: "bg-blue-50 text-blue-700" },
        { label: "Completed", value: report?.overview.completed ?? 0, filter: "COMPLETED", icon: <CheckCircle2 className="w-5 h-5" />, color: "bg-green-50 text-green-700" },
    ];

    return (
        <div className="min-h-screen bg-[var(--bg)] pb-24">
            <header className="px-6 py-5 lg:px-12 flex items-center justify-between border-b border-[var(--edge)] bg-white/50 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-6">
                    <Link href="/backoffice" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors font-mono text-sm group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span>Modules</span>
                    </Link>
                    <div className="h-4 w-px bg-[var(--edge)]" />
                    <h1 className="font-heading text-xl">Reporting</h1>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        className="rounded-xl border border-[var(--edge)] bg-white px-4 py-2 font-mono text-sm outline-none"
                        value={selectedCourse}
                        onChange={e => setSelectedCourse(e.target.value)}
                    >
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                    <button onClick={() => setShowColumnPanel(!showColumnPanel)} className="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-xl border border-[var(--edge)] hover:bg-gray-50 transition-colors">
                        <Columns className="w-3.5 h-3.5" /> Columns
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto mt-8 px-6">
                {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

                {/* Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {overviewCards.map(card => (
                        <button
                            key={card.label}
                            onClick={() => setStatusFilter(statusFilter === card.filter ? null : card.filter)}
                            className={`p-5 rounded-2xl border-2 transition-all text-left ${statusFilter === card.filter ? 'border-[var(--ink)] shadow-lg' : 'border-[var(--edge)]'} ${card.color}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                {card.icon}
                                {statusFilter === card.filter && <Filter className="w-3.5 h-3.5" />}
                            </div>
                            <p className="text-3xl font-heading font-semibold">{card.value}</p>
                            <p className="text-xs font-mono mt-1 opacity-70">{card.label}</p>
                        </button>
                    ))}
                </div>

                {/* Column Visibility Panel */}
                {showColumnPanel && (
                    <div className="mb-6 p-4 bg-white rounded-2xl border border-[var(--edge)] inline-flex flex-wrap gap-3">
                        {ALL_COLUMNS.map(col => (
                            <label key={col.key} className="flex items-center gap-2 text-sm font-mono cursor-pointer">
                                <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} className="rounded" />
                                {col.label}
                            </label>
                        ))}
                    </div>
                )}

                {/* Table */}
                {isLoading ? (
                    <div className="py-20 text-center"><p className="mono-note">Loading report...</p></div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border border-[var(--edge)] bg-white">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-[var(--edge)] text-left text-[var(--ink-soft)]">
                                    {visibleCols.has("sr") && <th className="px-4 py-3 font-mono text-xs">Sr.</th>}
                                    {visibleCols.has("name") && <th className="px-4 py-3 font-mono text-xs">Participant</th>}
                                    {visibleCols.has("email") && <th className="px-4 py-3 font-mono text-xs">Email</th>}
                                    {visibleCols.has("enrolledAt") && <th className="px-4 py-3 font-mono text-xs">Enrolled</th>}
                                    {visibleCols.has("startedAt") && <th className="px-4 py-3 font-mono text-xs">Started</th>}
                                    {visibleCols.has("completedAt") && <th className="px-4 py-3 font-mono text-xs">Finished</th>}
                                    {visibleCols.has("timeSpent") && <th className="px-4 py-3 font-mono text-xs">Time Spent</th>}
                                    {visibleCols.has("completedLessons") && <th className="px-4 py-3 font-mono text-xs">Completed</th>}
                                    {visibleCols.has("totalLessons") && <th className="px-4 py-3 font-mono text-xs">Total</th>}
                                    {visibleCols.has("completionPercent") && <th className="px-4 py-3 font-mono text-xs">Progress</th>}
                                    {visibleCols.has("status") && <th className="px-4 py-3 font-mono text-xs">Status</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map((row, i) => (
                                    <tr key={i} className="border-b border-[var(--edge)]/60 hover:bg-gray-50/50 transition-colors">
                                        {visibleCols.has("sr") && <td className="px-4 py-3 font-mono text-xs text-[var(--ink-soft)]">{i + 1}</td>}
                                        {visibleCols.has("name") && <td className="px-4 py-3 font-medium">{row.participantName}</td>}
                                        {visibleCols.has("email") && <td className="px-4 py-3 text-[var(--ink-soft)]">{row.participantEmail}</td>}
                                        {visibleCols.has("enrolledAt") && <td className="px-4 py-3 font-mono text-xs">{formatDate(row.enrolledAt)}</td>}
                                        {visibleCols.has("startedAt") && <td className="px-4 py-3 font-mono text-xs text-blue-600">{formatDate(row.startedAt)}</td>}
                                        {visibleCols.has("completedAt") && <td className="px-4 py-3 font-mono text-xs text-green-600">{formatDate(row.completedAt)}</td>}
                                        {visibleCols.has("timeSpent") && <td className="px-4 py-3 font-mono text-xs">{formatDuration(row.timeSpentSeconds)}</td>}
                                        {visibleCols.has("completedLessons") && <td className="px-4 py-3 font-mono">{row.completedLessons}</td>}
                                        {visibleCols.has("totalLessons") && <td className="px-4 py-3 font-mono">{row.totalLessons}</td>}
                                        {visibleCols.has("completionPercent") && (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-[var(--ink)] rounded-full" style={{ width: `${row.completionPercent}%` }} />
                                                    </div>
                                                    <span className="font-mono text-xs">{row.completionPercent}%</span>
                                                </div>
                                            </td>
                                        )}
                                        {visibleCols.has("status") && <td className="px-4 py-3">{statusBadge(row.status)}</td>}
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr><td colSpan={7} className="px-4 py-12 text-center text-[var(--ink-soft)]">No participants found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
