"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { ProtectedPage } from "@/components/protected-page";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type QuizTakeResponse = {
  quiz: {
    id: string;
    title: string;
    totalQuestions: number;
    nextAttemptNumber: number;
    questions: Array<{
      id: string;
      text: string;
      options: Array<{ id: string; text: string }>;
    }>;
  };
};

type QuizSubmitResponse = {
  result: {
    attemptNumber: number;
    scorePercent: number;
    totalQuestions: number;
    correctAnswers: number;
    earnedPoints: number;
  };
};

export default function QuizPage({ params }: { params: { quizId: string } }) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<QuizTakeResponse["quiz"] | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ questionId: string; optionIds: string[] }>>([]);
  const [result, setResult] = useState<QuizSubmitResponse["result"] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadQuiz() {
      const { data } = await getCurrentSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        return;
      }

      const response = await apiRequest<QuizTakeResponse>(`/quizzes/${params.quizId}/take`, { token: accessToken });
      if (active) {
        setQuiz(response.quiz);
        setToken(accessToken);
        setError(null);
      }
    }

    loadQuiz().catch((loadError) => {
      if (active) {
        setQuiz(null);
        setError(loadError instanceof Error ? loadError.message : "Could not load quiz");
      }
    });

    return () => {
      active = false;
    };
  }, [params.quizId]);

  const questionSet = quiz?.questions ?? [];
  const current = questionSet[index] ?? questionSet[0];

  const isLast = index === questionSet.length - 1;

  const progress = useMemo(() => `${index + 1}/${questionSet.length}`, [index, questionSet.length]);

  return (
    <ProtectedPage>
      <div className="min-h-screen bg-[var(--bg)] flex flex-col font-sans selection:bg-[var(--accent-blue)] selection:text-white pb-20">
        <header className="h-20 flex justify-between items-center px-8 lg:px-12 w-full">
          <div className="w-8 h-8 rounded-full bg-[var(--ink)] flex items-center justify-center">
            <span className="text-white font-mono text-sm font-bold">L</span>
          </div>
          <Link href="/courses" className="text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors flex items-center gap-2 font-mono text-xs uppercase tracking-widest">
            Exit <X className="w-4 h-4" />
          </Link>
        </header>

        <main className="flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full px-6 lg:px-12">
          {!quiz ? (
            <section className="bg-white border border-[var(--edge)] rounded-3xl p-6">
              <p className="mono-note">quiz</p>
              <p className="body-copy mt-3">{error ?? "Loading quiz..."}</p>
            </section>
          ) : null}

          {quiz && !started ? (
            <section className="bg-white border border-[var(--edge)] rounded-3xl p-6">
              <p className="mono-note">quiz intro</p>
              <h1 className="font-heading text-4xl lg:text-5xl mt-4">{quiz.title}</h1>
              <p className="body-copy mt-4">Total questions: {quiz.totalQuestions}</p>
              <p className="body-copy mt-1">Attempt: #{quiz.nextAttemptNumber}</p>
              <p className="body-copy mt-1">Multiple attempts are supported. Later attempts award fewer points.</p>
              <button className="action-chip mt-6" onClick={() => setStarted(true)}>Start Quiz</button>
            </section>
          ) : null}

          {quiz && started && current ? (
            <>
              <div className="flex gap-2 mb-16">
                {Array.from({ length: questionSet.length || 1 }).map((_, i) => (
                  <div
                    key={`bar-${i}`}
                    className={`w-8 h-1 rounded-full ${i < index ? "bg-[var(--ink)]" : i === index ? "bg-[var(--accent-blue)]" : "bg-[var(--edge)]"}`}
                  />
                ))}
              </div>

              <span className="font-mono text-sm text-[var(--accent-blue)] tracking-wider uppercase mb-6 block">Question {progress}</span>
              <h1 className="font-heading text-4xl lg:text-5xl font-medium leading-tight text-[var(--ink)] mb-16">{current.text}</h1>

              <div className="flex flex-col gap-4">
                {current.options.map((option) => (
                  <button
                    key={option.id}
                    className={`text-left w-full p-6 rounded-2xl border bg-white hover:border-[var(--ink)] hover:shadow-[0_10px_30px_-15px_rgba(26,28,41,0.1)] transition-all duration-300 flex items-center justify-between group ${selected.includes(option.id) ? "border-2 border-[var(--ink)] bg-[var(--accent-blue)]/5" : "border-[var(--edge)]"}`}
                    onClick={() => {
                      if (selected.includes(option.id)) {
                        setSelected(selected.filter((id) => id !== option.id));
                      } else {
                        setSelected([...selected, option.id]);
                      }
                    }}
                  >
                    <span className="font-medium text-lg lg:text-xl text-[var(--ink)]/80 group-hover:text-[var(--ink)] transition-colors">{option.text}</span>
                    <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ml-6 transition-colors ${selected.includes(option.id) ? "border-2 border-[var(--ink)] bg-[var(--ink)]" : "border-[var(--edge)] group-hover:border-[var(--ink)]"}`}>
                      {selected.includes(option.id) ? (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-16 text-right">
                <button
                  className="inline-flex items-center gap-3 bg-[var(--ink)] text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-[#2a2d43] hover:scale-105 transition-all duration-300 shadow-[0_10px_40px_-10px_rgba(26,28,41,0.4)] disabled:opacity-50 disabled:hover:scale-100"
                  disabled={selected.length === 0}
                  onClick={async () => {
                    if (selected.length === 0) return;
                    const nextAnswers = [
                      ...answers.filter((answer) => answer.questionId !== current.id),
                      { questionId: current.id, optionIds: selected }
                    ];

                    if (isLast) {
                      if (!token || !quiz) return;
                      const submit = await apiRequest<QuizSubmitResponse>(`/quizzes/${quiz.id}/submit`, {
                        method: "POST",
                        token,
                        body: { answers: nextAnswers }
                      });
                      setResult(submit.result);
                      setStarted(false);
                      setIndex(0);
                      setSelected([]);
                      setAnswers([]);
                      return;
                    }
                    setAnswers(nextAnswers);
                    setIndex((v) => v + 1);
                    setSelected([]);
                  }}
                >
                  {isLast ? "Complete Quiz" : "Next Question"}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </>
          ) : null}

          {result ? (
            <section className="mt-10 bg-white border border-[var(--edge)] rounded-3xl p-6">
              <p className="mono-note">result</p>
              <p className="body-copy mt-3">Score: {result.scorePercent}%</p>
              <p className="body-copy">Correct: {result.correctAnswers}/{result.totalQuestions}</p>
              <p className="body-copy">Points earned: {result.earnedPoints}</p>
            </section>
          ) : null}
        </main>
      </div>
    </ProtectedPage>
  );
}
