"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type LearnerCertificate = {
  id: string;
  certificateCode: string;
  randomPart: number;
  sequenceNumber: number;
  issuedAt: string;
  learnerName: string;
  courseTitle: string;
  instructorName: string;
};

type CourseCertificateResponse = {
  isOwner: boolean;
  progress: {
    completionPercent: number;
    status: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
  } | null;
  certificate?: LearnerCertificate | null;
};

export default function CourseCertificatePage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [certificate, setCertificate] = useState<LearnerCertificate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasAutoPrinted = useRef(false);

  useEffect(() => {
    let active = true;

    async function loadCertificate() {
      setIsLoading(true);
      setError(null);

      const { data } = await getCurrentSession();
      const token = data.session?.access_token;

      if (!token) {
        router.replace("/login");
        return;
      }

      const response = await apiRequest<CourseCertificateResponse>(`/courses/${params.courseId}`, {
        token,
        cacheTtlMs: 10000
      });

      if (!active) {
        return;
      }

      const isCompleted = response.progress?.completionPercent === 100 && response.progress?.status === "COMPLETED";

      if (response.isOwner || !isCompleted || !response.certificate) {
        setCertificate(null);
        setError("Complete the full course to unlock your certificate.");
      } else {
        setCertificate(response.certificate);
      }

      setIsLoading(false);
    }

    loadCertificate().catch(() => {
      if (active) {
        setCertificate(null);
        setError("Unable to load your certificate right now.");
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [params.courseId, router]);

  useEffect(() => {
    const shouldAutoDownload = searchParams.get("download") === "1";
    if (!shouldAutoDownload || !certificate || isLoading || hasAutoPrinted.current) {
      return;
    }

    hasAutoPrinted.current = true;
    const handle = setTimeout(() => {
      window.print();
    }, 200);

    return () => {
      clearTimeout(handle);
    };
  }, [certificate, isLoading, searchParams]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center px-6">
        <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--edge)] bg-white p-10 space-y-5 animate-pulse">
          <div className="h-5 w-40 rounded bg-gray-100" />
          <div className="h-10 w-3/4 rounded bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-32 w-full rounded-2xl bg-gray-100" />
          <div className="h-12 w-52 rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl rounded-[2rem] border border-[var(--edge)] bg-white p-10 shadow-xl">
        <div className="text-center border border-[var(--edge)] rounded-2xl p-8 bg-[#fffdf8]">
          <p className="font-mono uppercase text-[10px] tracking-[0.24em] text-[var(--ink-soft)] mb-3">Certificate of Completion</p>
          <h1 className="font-heading text-4xl mb-3">Learnova</h1>

          {certificate ? (
            <>
              <p className="text-sm text-[var(--ink-soft)] mb-6">This certifies that</p>
              <p className="font-heading text-3xl mb-4">{certificate.learnerName}</p>
              <p className="text-sm text-[var(--ink-soft)] mb-1">has successfully completed</p>
              <p className="font-heading text-2xl mb-6">{certificate.courseTitle}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="rounded-xl border border-[var(--edge)] bg-white px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)]">Certificate ID</p>
                  <p className="text-sm font-semibold mt-1">{certificate.certificateCode}</p>
                </div>
                <div className="rounded-xl border border-[var(--edge)] bg-white px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)]">Issued At</p>
                  <p className="text-sm font-semibold mt-1">{new Date(certificate.issuedAt).toLocaleDateString()}</p>
                </div>
                <div className="rounded-xl border border-[var(--edge)] bg-white px-4 py-3 md:col-span-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-soft)]">Instructor</p>
                  <p className="text-sm font-semibold mt-1">{certificate.instructorName}</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-red-600">{error ?? "Certificate not available."}</p>
          )}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-[var(--edge)] bg-white px-8 py-3 text-xs font-semibold hover:border-[var(--ink)] transition-colors"
          >
            Download Certificate
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl bg-[var(--ink)] text-white px-8 py-3 text-xs font-semibold hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
