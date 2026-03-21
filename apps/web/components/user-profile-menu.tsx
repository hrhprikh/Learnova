"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Award, BookOpen, LogOut } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession, signOutSession } from "@/lib/supabase-auth";

type Role = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type MeResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: Role;
    totalPoints: number;
    currentBadge: string | null;
    createdAt: string;
    badges: Array<{ id: string; achievedAt: string; badge: { id: string; name: string; thresholdPoints: number } }>;
  } | null;
};

type EnrolledResponse = {
  courses: Array<{ id: string; title: string }>;
};

type MineResponse = {
  courses: Array<{ id: string; title: string }>;
};

function rankFromPoints(totalPoints: number): string {
  if (totalPoints < 20) return "Newbie";
  if (totalPoints < 40) return "Explorer";
  if (totalPoints < 60) return "Achiever";
  if (totalPoints < 80) return "Specialist";
  if (totalPoints < 100) return "Expert";
  return "Master";
}

export function UserProfileMenu({ fullNameSeed }: { fullNameSeed?: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse["user"]>(null);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initToken() {
      const { data } = await getCurrentSession();
      setToken(data.session?.access_token ?? null);
    }
    initToken();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function loadProfileDetails() {
    if (!token) return;
    setIsLoading(true);
    try {
      const meResponse = await apiRequest<MeResponse>("/users/me", { token });
      setMe(meResponse.user);
      if (!meResponse.user) {
        setCourses([]);
        return;
      }

      if (meResponse.user.role === "LEARNER") {
        const enrolled = await apiRequest<EnrolledResponse>("/courses/enrolled", { token });
        setCourses(enrolled.courses.map((course) => ({ id: course.id, title: course.title })));
      } else {
        const mine = await apiRequest<MineResponse>("/courses?mine=true", { token });
        setCourses(mine.courses.map((course) => ({ id: course.id, title: course.title })));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !isOpen;
    setIsOpen(next);
    if (next && token) {
      await loadProfileDetails();
    }
  }

  async function onSignOut() {
    await signOutSession();
    router.replace("/login");
  }

  const rank = useMemo(
    () => me?.currentBadge ?? rankFromPoints(me?.totalPoints ?? 0),
    [me?.currentBadge, me?.totalPoints]
  );
  const avatarSeed = me?.fullName ?? fullNameSeed ?? "Learner";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="w-10 h-10 rounded-full bg-[#f2f0eb] overflow-hidden border border-[var(--edge)] hover:scale-105 transition-transform"
        aria-label="Open profile"
      >
        <img
          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=F8F7F4`}
          alt="Profile"
          className="w-full h-full object-cover"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-4 w-[340px] bg-white rounded-3xl border border-[var(--edge)] shadow-[0_20px_50px_rgba(0,0,0,0.15)] z-[110] overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-5 border-b border-[var(--edge)] bg-gray-50/60">
            <h3 className="font-heading text-lg">Your Profile</h3>
            {me ? <p className="text-xs text-[var(--ink-soft)] mt-1">{me.email}</p> : null}
          </div>

          <div className="p-5 space-y-4">
            {isLoading ? (
              <p className="text-sm text-[var(--ink-soft)]">Loading profile...</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-[var(--edge)] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)]">Total Points</p>
                    <p className="text-lg font-bold mt-1">{me?.totalPoints ?? 0}</p>
                  </div>
                  <div className="rounded-2xl border border-[var(--edge)] p-3">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)]">Rank</p>
                    <p className="text-lg font-bold mt-1">{rank}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--edge)] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mb-2">{me?.role === "LEARNER" ? "Purchased Courses" : "Created Courses"}</p>
                  {courses.length === 0 ? (
                    <p className="text-sm text-[var(--ink-soft)]">No courses yet</p>
                  ) : (
                    <ul className="space-y-2">
                      {courses.slice(0, 4).map((course) => (
                        <li key={course.id} className="text-sm flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-[var(--ink-soft)]" />
                          <span className="truncate">{course.title}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--edge)] p-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)] mb-2">Badge</p>
                  <div className="flex items-center gap-2 text-sm">
                    <Award className="w-4 h-4 text-[var(--accent-peach)]" />
                    <span className="font-semibold">{me?.currentBadge ?? rank}</span>
                  </div>
                  <p className="text-[11px] text-[var(--ink-soft)] mt-2">Member since {me ? new Date(me.createdAt).toLocaleDateString() : "-"}</p>
                </div>

                <div className="flex items-center justify-end pt-2">
                  <button
                    onClick={onSignOut}
                    className="text-xs font-semibold px-3 py-2 rounded-xl bg-[var(--ink)] text-white hover:opacity-90 transition-opacity inline-flex items-center gap-1"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
