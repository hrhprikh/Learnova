"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentSession } from "@/lib/supabase-auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    getCurrentSession().then(({ data }) => {
      if (active) {
        if (data?.session) {
          router.replace("/dashboard");
        } else {
          router.replace("/login");
        }
      }
    }).catch(() => {
      if (active) {
        router.replace("/login");
      }
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-[var(--ink)] flex items-center justify-center animate-pulse">
        <span className="text-white font-mono text-xl font-bold">L</span>
      </div>
    </div>
  );
}
