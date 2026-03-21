"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, PlayCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type CourseResponse = {
  course: {
    id: string;
    title: string;
    description: string | null;
    tags: Array<{ id: string; tag: string }>;
    lessons: Array<{
      id: string;
      title: string;
      type: "VIDEO" | "DOCUMENT" | "IMAGE" | "QUIZ";
      quiz: { id: string; title: string } | null;
    }>;
  };
  progress: {
    totalLessons: number;
    completedLessons: number;
    completionPercent: number;
  };
};

type EnrolledResponse = {
  lessons: Array<{
    id: string;
  }>;
};

type ReviewsResponse = {
  averageRating: number;
  reviews: Array<{
    id: string;
    rating: number;
    text: string;
    user: { id: string; fullName: string };
  }>;
};

export default function CoursePage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseResponse["course"] | null>(null);
  const [lessons, setLessons] = useState<CourseResponse["course"]["lessons"]>([]);
  const [progress, setProgress] = useState<CourseResponse["progress"] | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCourse() {
      const { data } = await getCurrentSession();
      const token = data.session?.access_token;
      const [courseResponse, reviewsResponse] = await Promise.all([
        apiRequest<CourseResponse>(`/courses/${params.courseId}`, { token }),
        apiRequest<ReviewsResponse>(`/courses/${params.courseId}/reviews`)
      ]);

      let enrolled = false;
      if (token) {
        const enrolledResponse = await apiRequest<{ courses: Array<{ id: string }> }>("/courses/enrolled", { token });
        enrolled = enrolledResponse.courses.some((item) => item.id === params.courseId);
      }

      if (active) {
        setToken(token ?? null);
        setError(null);
        setIsEnrolled(enrolled);
        setCourse(courseResponse.course);
        setLessons(courseResponse.course.lessons);
        setProgress(courseResponse.progress);
        setReviews(reviewsResponse);
      }
    }

    loadCourse().catch((loadError) => {
      if (active) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load course");
        setCourse(null);
        setLessons([]);
        setProgress(null);
        setReviews(null);
      }
    });

    return () => {
      active = false;
    };
  }, [params.courseId]);

  async function enrollNow() {
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setIsEnrolling(true);
      setError(null);
      await apiRequest(`/courses/${params.courseId}/enroll`, {
        method: "POST",
        token
      });
      setIsEnrolled(true);
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Could not enroll");
    } finally {
      setIsEnrolling(false);
    }
  }

  async function submitReview() {
    if (!token || !reviewText.trim()) {
      return;
    }

    try {
      setIsSubmittingReview(true);
      setError(null);
      await apiRequest(`/courses/${params.courseId}/reviews`, {
        method: "POST",
        token,
        body: {
          rating,
          text: reviewText.trim()
        }
      });

      const refreshed = await apiRequest<ReviewsResponse>(`/courses/${params.courseId}/reviews`);
      setReviews(refreshed);
      setReviewText("");
      setRating(5);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not submit review");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  const firstLessonId = lessons[0]?.id;
  const completedLessons = progress?.completedLessons ?? 0;
  const currentLessonIndex = Math.min(completedLessons, Math.max(lessons.length - 1, 0));

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pb-24">
      <header className="px-6 py-8 lg:px-12 flex items-center justify-between">
        <Link href="/courses" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors font-mono text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Courses</span>
        </Link>
        <div className="font-mono text-xs px-3 py-1 rounded bg-white border border-[var(--edge)]">
          Module <span className="text-[var(--ink)] font-semibold">{String((progress?.totalLessons ?? 0)).padStart(2, "0")}</span>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
          <div className="lg:col-span-7">
            <h1 className="font-heading text-5xl lg:text-7xl font-semibold leading-[1.05] tracking-tight mb-8">
              {course?.title ?? "Course"}
            </h1>

            <div className="flex items-center gap-6 font-mono text-sm text-[var(--ink-soft)] mb-12 pb-12 border-b border-[var(--edge)]">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" /> {progress?.totalLessons ?? 0} Lessons</span>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--accent-peach)]" /> {lessons.filter((l) => l.type === "QUIZ").length} Quizzes</span>
              <span>{progress?.completionPercent ?? 0}% complete</span>
            </div>

            <article className="prose prose-lg prose-headings:font-heading prose-headings:font-medium prose-p:leading-relaxed prose-a:text-[var(--accent-blue)]">
              <p className="text-xl text-[var(--ink)]/80 leading-relaxed font-serif mb-8">
                {course?.description ?? "Build resilient and memorable interfaces by learning through structured, practical lessons."}
              </p>
            </article>

            <section className="mt-10 bg-white border border-[var(--edge)] rounded-3xl p-6">
              <p className="mono-note">ratings and reviews</p>
              {token && isEnrolled ? (
                <div className="mt-4 grid gap-3 md:grid-cols-[120px_1fr_auto]">
                  <select
                    className="rounded-xl border border-[var(--edge)] bg-white px-3 py-2"
                    value={rating}
                    onChange={(event) => setRating(Number(event.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>{value} stars</option>
                    ))}
                  </select>
                  <input
                    className="rounded-xl border border-[var(--edge)] bg-white px-3 py-2"
                    placeholder="Share your review"
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                  />
                  <button onClick={submitReview} disabled={isSubmittingReview || !reviewText.trim()} className="action-chip">
                    {isSubmittingReview ? "Posting..." : "Add review"}
                  </button>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                {(reviews?.reviews ?? []).slice(0, 5).map((review) => (
                  <article key={review.id} className="lesson-row">
                    <span className="mono-tag">{review.rating}/5</span>
                    <span className="body-copy flex-1">{review.text}</span>
                    <span className="mono-tag">{review.user.fullName}</span>
                  </article>
                ))}
                {(reviews?.reviews ?? []).length === 0 ? <p className="body-copy">No reviews yet.</p> : null}
              </div>
            </section>
          </div>

          <div className="lg:col-span-5 relative mt-8 lg:mt-0">
            <div className="sticky top-12 bg-white p-8 rounded-3xl border border-[var(--edge)] shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)]">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <h3 className="font-mono text-xs text-[var(--ink-soft)] uppercase tracking-widest mb-2">Syllabus Index</h3>
                  <p className="font-heading text-xl">Module Content</p>
                </div>
                <div className="text-right">
                  <span className="font-mono flex items-center gap-1 text-sm">
                    <span className="text-[var(--accent-blue)]">{Math.min(completedLessons + 1, lessons.length || 1)}</span>
                    <span className="text-[var(--ink-soft)]">/ {lessons.length || 0}</span>
                  </span>
                </div>
              </div>

              <ul className="flex flex-col relative before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-[var(--edge)]/60">
                {lessons.map((lesson, index) => {
                  const isCompleted = index < completedLessons;
                  const isCurrent = index === currentLessonIndex;
                  const isLocked = !isEnrolled || index > currentLessonIndex + 1;

                  return (
                    <li
                      key={lesson.id}
                      className={`relative pl-10 py-5 border-b border-[var(--edge)]/40 last:border-0 group ${isCurrent ? "bg-[#f2f0eb] -mx-4 px-4 pr-0 rounded-lg" : ""} ${isLocked ? "opacity-60" : ""}`}
                    >
                      <div className={`absolute left-2.5 top-6 rounded-full ring-4 -translate-x-1/2 z-10 ${isCompleted ? "w-2.5 h-2.5 bg-[var(--ink)] ring-white" : isCurrent ? "w-3 h-3 bg-[var(--accent-peach)] ring-[#f2f0eb]" : "w-2 h-2 border border-[var(--ink-soft)] bg-white ring-white"}`} />
                      <div className={`${isCurrent ? "pl-6" : ""}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className={`font-mono text-[10px] tracking-wider block mb-1 ${isCurrent ? "text-[var(--accent-peach)]" : "text-[var(--ink-soft)]"}`}>
                              SECTION {String(index + 1).padStart(2, "0")}{isCurrent ? " (Current)" : ""}
                            </span>
                            <h4 className={`font-medium ${isLocked ? "text-[var(--ink-soft)]" : "text-[var(--ink)] group-hover:text-[var(--accent-blue)] transition-colors"}`}>{lesson.title}</h4>
                          </div>
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-[var(--accent-blue)] opacity-80" />
                          ) : isCurrent ? (
                            <PlayCircle className="w-5 h-5 text-[var(--accent-peach)]" />
                          ) : isLocked ? (
                            <Lock className="w-4 h-4 text-[var(--ink-soft)] mt-0.5" />
                          ) : null}
                        </div>
                        {!isLocked ? (
                          <Link href={`/learn/${params.courseId}/${lesson.id}`} className="floating-link mt-3 inline-flex">Open lesson</Link>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 pt-5 border-t border-[var(--edge)]/70">
                {isEnrolled && firstLessonId ? (
                  <Link href={`/learn/${params.courseId}/${firstLessonId}`} className="action-chip inline-block">
                    {(progress?.completionPercent ?? 0) > 0 ? "Continue learning" : "Start learning"}
                  </Link>
                ) : (
                  <button onClick={enrollNow} disabled={isEnrolling} className="action-chip inline-block">
                    {isEnrolling ? "Joining..." : token ? "Enroll now" : "Login to enroll"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
      </main>
    </div>
  );
}
