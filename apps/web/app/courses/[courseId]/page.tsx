"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Lock, PlayCircle, Mail, X, ExternalLink, Download } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type CourseResponse = {
  course: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    accessRule: "OPEN" | "SIGNED_IN" | "PAYMENT" | "INVITATION";
    price: number | null;
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
    status: "YET_TO_START" | "IN_PROGRESS" | "COMPLETED";
  } | null;
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
  const [searchTerm, setSearchTerm] = useState("");
  const [progress, setProgress] = useState<CourseResponse["progress"] | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: "", body: "" });
  const [isSending, setIsSending] = useState(false);
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
        apiRequest<CourseResponse & { isOwner: boolean }>(`/courses/${params.courseId}`, { token }),
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
        setIsOwner(courseResponse.isOwner);
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

  async function enrollNow(paymentToken?: string) {
    if (!token) {
      router.push("/login");
      return;
    }

    try {
      setIsEnrolling(true);
      setError(null);
      await apiRequest(`/courses/${params.courseId}/enroll`, {
        method: "POST",
        token,
        body: paymentToken ? { paymentToken } : undefined
      });
      setIsEnrolled(true);
      setShowBuyModal(false);
    } catch (enrollError) {
      setError(enrollError instanceof Error ? enrollError.message : "Enrollment failed");
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

  const filteredLessons = lessons.filter(lesson => 
    lesson.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] pb-24">
      <header className="px-6 py-8 lg:px-12 flex items-center justify-between">
        <Link href="/courses" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors font-mono text-sm group">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Courses</span>
        </Link>
        <div className="flex items-center gap-4">
          <NotificationBell />
          <div className="font-mono text-xs px-3 py-1 rounded bg-white border border-[var(--edge)]">
            Module <span className="text-[var(--ink)] font-semibold">{String((progress?.totalLessons ?? 0)).padStart(2, "0")}</span>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
          <div className="lg:col-span-7">
            {course?.imageUrl && (
              <div className="mb-10 rounded-[2.5rem] overflow-hidden border border-[var(--edge)] bg-gray-100 aspect-video lg:aspect-[21/9] shadow-inner">
                <img src={course.imageUrl} alt={course.title} className="w-full h-full object-cover" />
              </div>
            )}
            
            <h1 className="font-heading text-5xl lg:text-7xl font-semibold leading-[1.05] tracking-tight mb-8">
              {course?.title ?? "Course"}
            </h1>

            <div className="flex flex-wrap items-center gap-6 font-mono text-sm text-[var(--ink-soft)] mb-12 pb-12 border-b border-[var(--edge)]">
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" /> {progress?.totalLessons ?? 0} Lessons</span>
              <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--accent-peach)]" /> {lessons.filter((l) => l.type === "QUIZ").length} Quizzes</span>
              <span>{progress?.completionPercent ?? 0}% complete</span>
              <div className="flex gap-2">
                {course?.tags.map(t => <span key={t.id} className="px-2 py-0.5 rounded-full bg-white border border-[var(--edge)] text-[10px]">{t.tag}</span>)}
              </div>
            </div>

            <article className="prose prose-lg prose-headings:font-heading prose-headings:font-medium prose-p:leading-relaxed prose-a:text-[var(--accent-blue)]">
              <p className="text-xl text-[var(--ink)]/80 leading-relaxed font-serif mb-8">
                {course?.description ?? "Build resilient and memorable interfaces by learning through structured, practical lessons."}
              </p>
            </article>

            {course && (
              <>
                <div className="flex flex-wrap items-center gap-6 mb-10">
                  <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs">
                          {course.accessRule === 'PAYMENT' ? '$' : 'F'}
                      </div>
                      <div>
                          <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink-soft)]">Course Fee</p>
                          <p className="text-sm font-bold">{course.accessRule === 'PAYMENT' ? `$${course.price}` : 'Free Access'}</p>
                      </div>
                  </div>
                  <div className="h-8 w-px bg-[var(--edge)]" />
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink-soft)] mb-1">Access Rule</p>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-[var(--ink)] text-[10px] font-mono font-bold uppercase tracking-tight">{course.accessRule}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 mb-12">
                  {isEnrolled ? (
                    <Link href={`/learn/${params.courseId}/${firstLessonId}`} className="action-chip px-12 py-4 text-base">
                      {progress?.status === "COMPLETED" ? "Review Course" : progress?.status === "IN_PROGRESS" ? "Continue Learning" : "Start Now"}
                    </Link>
                  ) : course.accessRule === "PAYMENT" ? (
                    <button onClick={() => setShowBuyModal(true)} className="action-chip px-12 py-4 text-base">
                      Buy Course — ${course.price}
                    </button>
                  ) : (
                    <button onClick={() => enrollNow()} className="action-chip px-12 py-4 text-base">
                      Enroll Now
                    </button>
                  )}
                  
                  <button onClick={() => setShowMessageModal(true)} className="flex items-center gap-2 font-mono text-xs px-6 py-4 rounded-full border border-[var(--edge)] hover:border-[var(--ink)] transition-all">
                    <Mail className="w-4 h-4" /> Message Instructor
                  </button>
                </div>
              </>
            )}

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
                    className="rounded-xl border border-[var(--edge)] bg-white px-3 py-2 text-sm"
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
                    <span className="body-copy flex-1 text-sm">{review.text}</span>
                    <span className="mono-tag text-[9px]">{review.user.fullName}</span>
                  </article>
                ))}
                {(reviews?.reviews ?? []).length === 0 ? <p className="body-copy text-sm">No reviews yet.</p> : null}
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

              {/* Lesson Search */}
              <div className="mb-6 relative">
                 <input 
                    type="text"
                    placeholder="Search lessons..."
                    className="w-full bg-[#fcfbfa] border border-[var(--edge)] rounded-xl py-2 pl-4 pr-10 text-xs outline-none focus:border-[var(--ink)] transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                 />
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                 </div>
              </div>

              <ul className="flex flex-col relative before:absolute before:inset-y-0 before:left-3.5 before:w-px before:bg-[var(--edge)]/60 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
                {filteredLessons.map((lesson) => {
                  const realIndex = lessons.findIndex(l => l.id === lesson.id);
                  const isCompleted = realIndex < completedLessons;
                  const isCurrent = realIndex === currentLessonIndex;
                  const isLocked = !isEnrolled && !isOwner && realIndex > currentLessonIndex + 1;

                  return (
                    <li
                      key={lesson.id}
                      className={`relative pl-10 py-5 border-b border-[var(--edge)]/40 last:border-0 group ${isCurrent ? "bg-[#f2f0eb] -mx-4 px-4 pr-0 rounded-lg" : ""} ${isLocked ? "opacity-60" : "hover:bg-white transition-colors cursor-pointer"}`}
                    >
                      {!isLocked ? (
                        <Link href={`/learn/${params.courseId}/${lesson.id}`} className="absolute inset-0 z-20" aria-label={`Open ${lesson.title}`} />
                      ) : null}
                      <div className={`absolute left-2.5 top-6 rounded-full ring-4 -translate-x-1/2 z-10 ${isCompleted ? "w-2.5 h-2.5 bg-[var(--ink)] ring-white" : isCurrent ? "w-3 h-3 bg-[var(--accent-peach)] ring-[#f2f0eb]" : "w-2 h-2 border border-[var(--ink-soft)] bg-white ring-white"}`} />
                      <div className={`${isCurrent ? "pl-6" : ""}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className={`font-mono text-[10px] tracking-wider block mb-1 ${isCurrent ? "text-[var(--accent-peach)]" : "text-[var(--ink-soft)]"}`}>
                              SECTION {String(realIndex + 1).padStart(2, "0")}{isCurrent ? " (Current)" : ""}
                            </span>
                            <h4 className={`font-medium text-sm relative z-10 ${isLocked ? "text-[var(--ink-soft)]" : "text-[var(--ink)] group-hover:text-[var(--accent-blue)] transition-colors"}`}>{lesson.title}</h4>
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
                          <span className="floating-link mt-3 inline-flex relative z-10 opacity-70 group-hover:opacity-100 transition-opacity text-[10px]">Open lesson</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
                {filteredLessons.length === 0 && (
                   <div className="py-12 text-center text-[var(--ink-soft)] font-mono text-[10px]">No lessons match your search</div>
                )}
              </ul>

              {(() => {
                async function handleComplete() {
                  if (!token) return;
                  try {
                    setError(null);
                    await apiRequest(`/courses/${params.courseId}/complete`, {
                      method: "POST",
                      token
                    });
                    if (progress) {
                      setProgress({ ...progress, status: "COMPLETED" });
                    }
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to complete course");
                  }
                }

                return (
                  <div className="mt-6 pt-5 border-t border-[var(--edge)]/70">
                    {isOwner ? (
                       <div className="flex flex-col gap-3">
                         <div className="p-3 bg-[var(--accent-peach)]/10 rounded-xl border border-[var(--accent-peach)]/20 text-center">
                            <p className="font-mono text-[9px] uppercase tracking-widest text-[var(--accent-peach)] font-bold">Instructor View</p>
                         </div>
                         <Link href={`/learn/${params.courseId}/${firstLessonId}`} className="action-chip inline-block text-sm text-center">
                            Preview lessons
                         </Link>
                       </div>
                    ) : isEnrolled && firstLessonId ? (
                      <div className="flex flex-col gap-3">
                        <Link href={`/learn/${params.courseId}/${firstLessonId}`} className="action-chip inline-block text-sm text-center">
                          {(progress?.completionPercent ?? 0) > 0 ? "Continue learning" : "Start learning"}
                        </Link>
                        {progress?.completionPercent === 100 && progress?.status !== "COMPLETED" && (
                          <button 
                            onClick={handleComplete}
                            className="w-full bg-[var(--accent-blue)] text-white py-3 rounded-xl font-bold text-xs shadow-lg hover:scale-105 active:scale-95 transition-all animate-pulse"
                          >
                            Complete this Course
                          </button>
                        )}
                        {progress?.status === "COMPLETED" && (
                          <div className="p-4 bg-[var(--accent-blue)]/10 rounded-2xl border border-[var(--accent-blue)]/20 text-center">
                            <p className="font-heading text-sm font-bold text-[var(--accent-blue)]">Course Completed! 🎉</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button 
                        onClick={() => course?.accessRule === "PAYMENT" ? setShowBuyModal(true) : enrollNow()} 
                        disabled={isEnrolling} 
                        className="action-chip inline-block text-sm text-center w-full"
                      >
                        {isEnrolling ? "Joining..." : course?.accessRule === "PAYMENT" ? `Buy for $${course.price ?? "19.99"}` : token ? "Enroll now" : "Login to enroll"}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Purchase Modal */}
        {showBuyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white rounded-[2.5rem] p-10 max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-300">
              <button onClick={() => setShowBuyModal(false)} className="absolute top-6 right-6 text-[var(--ink-soft)] hover:text-[var(--ink)]">
                 <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="font-heading text-3xl font-bold mb-2">Secure Checkout</h2>
              <p className="text-[var(--ink-soft)] text-sm font-mono uppercase tracking-widest mb-8">Access to "{course?.title}"</p>
              
              <div className="bg-[#fcfbfa] border border-[var(--edge)] rounded-2xl p-6 mb-8">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium">Standard License</span>
                    <span className="font-heading text-xl font-bold">${course?.price ?? "19.99"}</span>
                 </div>
                 <div className="text-[10px] text-[var(--ink-soft)] leading-relaxed">
                    By purchasing, you get lifetime access to all {lessons.length} lessons, attachments, and quizzes within this learning module.
                 </div>
              </div>

              <button 
                onClick={() => enrollNow("mock_success_token")}
                disabled={isEnrolling}
                className="w-full bg-[var(--ink)] text-white py-4 rounded-xl font-bold text-sm shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
              >
                {isEnrolling ? "Processing..." : "Confirm Purchase"}
              </button>
              <p className="text-center mt-6 text-[10px] text-[var(--ink-soft)]">Secure Mock Payment — No actual charges apply.</p>
            </div>
          </div>
        )}


        {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}
      </main>

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-10 max-w-xl w-full shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => setShowMessageModal(false)} className="absolute top-8 right-8 text-[var(--ink-soft)] hover:text-[var(--ink)]"><X className="w-6 h-6" /></button>
            <h2 className="font-heading text-3xl font-bold mb-2">Message Instructor</h2>
            <p className="body-copy-sm mb-8">Send a question or inquiry about this course directly to the instructor.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Subject</label>
                <input 
                  className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors" 
                  placeholder="Inquiry about..."
                  value={messageForm.subject}
                  onChange={e => setMessageForm({...messageForm, subject: e.target.value})}
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase tracking-widest text-[var(--ink-soft)] block mb-2">Your Message</label>
                <textarea 
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-[var(--edge)] outline-none focus:border-[var(--ink)] transition-colors leading-relaxed" 
                  placeholder="Type your message here..."
                  value={messageForm.body}
                  onChange={e => setMessageForm({...messageForm, body: e.target.value})}
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-end">
              <button 
                onClick={async () => {
                  if (!token) return;
                  setIsSending(true);
                  try {
                    await apiRequest(`/courses/${params.courseId}/message`, {
                      method: "POST",
                      token,
                      body: messageForm
                    });
                    setShowMessageModal(false);
                    setMessageForm({ subject: "", body: "" });
                    alert("Your message has been sent to the instructor!");
                  } catch (err) {
                    alert("Failed to send message: " + (err instanceof Error ? err.message : "Error"));
                  } finally {
                    setIsSending(false);
                  }
                }}
                disabled={isSending || !messageForm.subject || !messageForm.body}
                className="action-chip px-8 disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
