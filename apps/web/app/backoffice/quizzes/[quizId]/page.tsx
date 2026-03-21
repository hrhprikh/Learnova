"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, CheckCircle2, Circle, Trash2, Save, Award } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getCurrentSession } from "@/lib/supabase-auth";

type Option = {
  id?: string;
  text: string;
  isCorrect: boolean;
};

type Question = {
  id: string;
  text: string;
  orderIndex: number;
  options: Option[];
};

type Quiz = {
  id: string;
  title: string;
  rewardAttempt1: number;
  rewardAttempt2: number;
  rewardAttempt3: number;
  rewardAttempt4Plus: number;
  questions: Question[];
};

export default function QuizBuilder({ params }: { params: { quizId: string } }) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedItem, setSelectedItem] = useState<"REWARDS" | string>("REWARDS");
  
  // Local state for edits
  const [rewardsEdit, setRewardsEdit] = useState({ r1: 20, r2: 14, r3: 9, r4: 5 });
  const [questionEdit, setQuestionEdit] = useState<Question | null>(null);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadQuiz() {
      try {
        const { data } = await getCurrentSession();
        const t = data.session?.access_token;
        if (!t) throw new Error("Not authenticated");
        setToken(t);

        const response = await apiRequest<{ quiz: Quiz }>(`/quizzes/${params.quizId}`, { token: t });
        if (active) {
          setQuiz(response.quiz);
          setRewardsEdit({
            r1: response.quiz.rewardAttempt1,
            r2: response.quiz.rewardAttempt2,
            r3: response.quiz.rewardAttempt3,
            r4: response.quiz.rewardAttempt4Plus,
          });
          if (response.quiz?.questions && response.quiz.questions.length > 0) {
            setSelectedItem(response.quiz.questions[0]!.id);
          }
        }
      } catch {
        if (active) setError("Could not load quiz details");
      }
    }
    loadQuiz();
    return () => { active = false; };
  }, [params.quizId]);

  useEffect(() => {
    if (selectedItem !== "REWARDS" && quiz) {
      const q = quiz.questions.find(q => q.id === selectedItem);
      if (q) {
        setQuestionEdit(JSON.parse(JSON.stringify(q)));
      }
    }
  }, [selectedItem, quiz]);

  async function handleAddQuestion() {
    if (!token || !quiz) return;
    try {
      const response = await apiRequest<{ question: Question }>(`/quizzes/${quiz.id}/questions`, {
        method: "POST",
        token,
        body: { text: "New Question" }
      });
      setQuiz({
        ...quiz,
        questions: [...quiz.questions, response.question]
      });
      setSelectedItem(response.question.id);
    } catch {
      alert("Failed to add question");
    }
  }

  async function handleSaveRewards() {
    if (!token || !quiz) return;
    setIsSaving(true);
    try {
      const response = await apiRequest<{ quiz: Quiz }>(`/quizzes/${quiz.id}/rewards`, {
        method: "PUT",
        token,
        body: {
          rewardAttempt1: rewardsEdit.r1,
          rewardAttempt2: rewardsEdit.r2,
          rewardAttempt3: rewardsEdit.r3,
          rewardAttempt4Plus: rewardsEdit.r4,
        }
      });
      setQuiz({ ...quiz, ...response.quiz });
      alert("Rewards saved successfully");
    } catch {
      alert("Failed to save rewards");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveQuestion() {
    if (!token || !quiz || !questionEdit) return;
    
    // Validate
    if (!questionEdit.text.trim()) return alert("Question text cannot be empty");
    if (questionEdit.options.length < 2) return alert("Must have at least 2 options");
    if (!questionEdit.options.some(o => o.isCorrect)) return alert("Must select a correct option");
    if (questionEdit.options.some(o => !o.text.trim())) return alert("Option text cannot be empty");

    setIsSaving(true);
    try {
      const response = await apiRequest<{ question: Question }>(`/quizzes/${quiz.id}/questions/${questionEdit.id}`, {
        method: "PUT",
        token,
        body: {
          text: questionEdit.text,
          options: questionEdit.options
        }
      });
      setQuiz({
        ...quiz,
        questions: quiz.questions.map(q => q.id === questionEdit.id ? response.question : q)
      });
      alert("Question saved successfully");
    } catch {
      alert("Failed to save question");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!token || !quiz || !questionEdit) return;
    if (!confirm("Are you sure you want to delete this question?")) return;
    
    setIsSaving(true);
    try {
      await apiRequest(`/quizzes/${quiz.id}/questions/${questionEdit.id}`, {
        method: "DELETE",
        token
      });
      const updatedQuestions = quiz.questions?.filter(q => q.id !== questionEdit.id) || [];
      setQuiz({
        ...quiz,
        questions: updatedQuestions
      });
      setSelectedItem(updatedQuestions.length > 0 ? (updatedQuestions[0]?.id || "REWARDS") : "REWARDS");
    } catch {
      alert("Failed to delete question");
    } finally {
      setIsSaving(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg)] p-12">
        <Link href="/backoffice" className="floating-link inline-flex"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
        <p className="mt-8 text-red-600">{error}</p>
      </div>
    );
  }

  if (!quiz) return <div className="min-h-screen bg-[var(--bg)] p-12"><p className="mono-note">Loading quiz editor...</p></div>;

  return (
    <div className="min-h-screen bg-[#FCFBFA] flex flex-col font-sans">
      <header className="h-16 px-6 lg:px-8 flex items-center justify-between border-b border-[var(--edge)] bg-white sticky top-0 z-40">
        <div className="flex items-center gap-6">
          <Link href="/backoffice" className="inline-flex items-center gap-2 text-[var(--ink-soft)] hover:text-[var(--ink)] transition-colors font-mono text-sm group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Module</span>
          </Link>
          <div className="h-4 w-px bg-[var(--edge)]" />
          <h1 className="font-heading text-lg font-medium">{quiz.title} Builder</h1>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <aside className="w-80 bg-white border-r border-[var(--edge)] flex flex-col h-[calc(100vh-64px)] overflow-y-auto">
          <div className="p-4 border-b border-[var(--edge)] space-y-3">
            <button 
              onClick={() => setSelectedItem("REWARDS")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${selectedItem === "REWARDS" ? "bg-[#f2f0eb] border border-[var(--ink)] shadow-sm" : "hover:bg-[#f7f5f0] border border-transparent"}`}
            >
              <Award className="w-5 h-5 text-[var(--accent-purple)]" />
              <span className="font-medium">Rewards Policy</span>
            </button>
            <button 
              onClick={handleAddQuestion}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[var(--edge)] hover:bg-[#f2f0eb] transition-colors text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>

          <div className="p-4 flex-1">
            <p className="mono-note mb-4 px-2 tracking-widest text-[10px]">QUESTIONS ({quiz.questions.length})</p>
            <div className="space-y-2">
              {quiz.questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setSelectedItem(q.id)}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all border ${selectedItem === q.id ? "bg-white border-[var(--ink)] shadow-sm" : "bg-transparent border-transparent hover:bg-[#f2f0eb]"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="font-mono text-xs mt-0.5 text-[var(--ink-soft)]">{String(idx + 1).padStart(2, '0')}</span>
                    <p className="text-sm font-medium line-clamp-2 leading-relaxed">{q.text || "Empty Question"}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Editor Area */}
        <section className="flex-1 p-8 lg:p-12 h-[calc(100vh-64px)] overflow-y-auto">
          <div className="max-w-3xl mx-auto">
            
            {/* Awards Edit Mode */}
            {selectedItem === "REWARDS" && (
              <div className="paper-panel border border-[var(--edge)] rounded-3xl p-8 bg-white shadow-sm">
                <span className="mono-note">Configuration</span>
                <h2 className="font-heading text-3xl font-medium mt-4 mb-2">Completion Rewards</h2>
                <p className="text-[var(--ink-soft)] mb-8 max-w-xl leading-relaxed">Set the number of points a learner earns based on the attempt number. Later attempts generally earn fewer points.</p>
                
                <div className="space-y-6">
                  <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--edge)] bg-[#fcfbfa]">
                    <div>
                      <p className="font-medium text-[var(--ink)]">First Try (Attempt 1)</p>
                      <p className="text-sm text-[var(--ink-soft)]">Points awarded on first successful pass</p>
                    </div>
                    <input type="number" min="0" value={rewardsEdit.r1} onChange={e => setRewardsEdit({...rewardsEdit, r1: parseInt(e.target.value) || 0})} className="w-24 px-3 py-2 border border-[var(--edge)] rounded outline-none text-right font-mono" />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--edge)] bg-[#fcfbfa]">
                    <div>
                      <p className="font-medium text-[var(--ink)]">Second Try (Attempt 2)</p>
                    </div>
                    <input type="number" min="0" value={rewardsEdit.r2} onChange={e => setRewardsEdit({...rewardsEdit, r2: parseInt(e.target.value) || 0})} className="w-24 px-3 py-2 border border-[var(--edge)] rounded outline-none text-right font-mono" />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--edge)] bg-[#fcfbfa]">
                    <div>
                      <p className="font-medium text-[var(--ink)]">Third Try (Attempt 3)</p>
                    </div>
                    <input type="number" min="0" value={rewardsEdit.r3} onChange={e => setRewardsEdit({...rewardsEdit, r3: parseInt(e.target.value) || 0})} className="w-24 px-3 py-2 border border-[var(--edge)] rounded outline-none text-right font-mono" />
                  </label>
                  
                  <label className="flex items-center justify-between p-4 rounded-xl border border-[var(--edge)] bg-[#fcfbfa]">
                    <div>
                      <p className="font-medium text-[var(--ink)]">Fourth Try & More (Attempt 4+)</p>
                      <p className="text-sm text-[var(--ink-soft)]">Base points for persistent attempts</p>
                    </div>
                    <input type="number" min="0" value={rewardsEdit.r4} onChange={e => setRewardsEdit({...rewardsEdit, r4: parseInt(e.target.value) || 0})} className="w-24 px-3 py-2 border border-[var(--edge)] rounded outline-none text-right font-mono" />
                  </label>
                </div>

                <div className="mt-8 flex justify-end">
                  <button onClick={handleSaveRewards} disabled={isSaving} className="action-chip px-8 flex items-center gap-2">
                    <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Rewards"}
                  </button>
                </div>
              </div>
            )}

            {/* Question Edit Mode */}
            {selectedItem !== "REWARDS" && questionEdit && (
              <div className="paper-panel border border-[var(--edge)] rounded-3xl p-8 bg-white shadow-sm">
                <span className="mono-note text-[var(--accent-blue)]">Editor</span>
                <div className="mt-6 mb-8 flex justify-between items-start">
                   <textarea
                     value={questionEdit.text}
                     onChange={e => setQuestionEdit({ ...questionEdit, text: e.target.value })}
                     placeholder="Type your question here..."
                     className="w-full font-heading text-2xl lg:text-3xl font-medium outline-none resize-none placeholder:text-[var(--edge)]"
                     rows={3}
                   />
                </div>

                <div className="space-y-4">
                  <p className="font-mono text-xs tracking-widest text-[var(--ink-soft)] uppercase mb-2">Options</p>
                  {questionEdit.options.map((opt, idx) => (
                    <div key={idx} className={`flex items-center gap-4 p-3 rounded-xl border transition-colors ${opt.isCorrect ? "border-[var(--ink)] bg-[var(--accent-blue)]/5" : "border-[var(--edge)] bg-white"}`}>
                      <button
                        onClick={() => {
                          if (!questionEdit) return;
                          const newOpts = questionEdit.options.map((o, i) => i === idx ? { ...o, isCorrect: !o.isCorrect } : o);
                          setQuestionEdit({ ...questionEdit, options: newOpts });
                        }}
                        className="shrink-0 group"
                      >
                        {opt.isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-[var(--ink)]" />
                        ) : (
                          <Circle className="w-6 h-6 text-[var(--edge)] group-hover:text-[var(--ink-soft)] transition-colors" />
                        )}
                      </button>
                      
                      <input 
                        className="flex-1 bg-transparent outline-none text-lg font-medium"
                        value={opt.text}
                        onChange={e => {
                          if (!questionEdit) return;
                          const newOpts = [...questionEdit.options];
                          newOpts[idx]!.text = e.target.value;
                          setQuestionEdit({ ...questionEdit, options: newOpts });
                        }}
                        placeholder={`Option ${idx + 1}`}
                      />
                      
                      <button 
                        onClick={() => {
                          if (!questionEdit) return;
                          const newOpts = questionEdit.options.filter((_, i) => i !== idx);
                          setQuestionEdit({ ...questionEdit, options: newOpts });
                        }}
                        className="p-2 text-[var(--edge)] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                        title="Remove Option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button 
                    onClick={() => {
                      setQuestionEdit(prev => prev ? ({
                         ...prev,
                         options: [...prev.options, { text: "", isCorrect: prev.options.length === 0 }]
                      }) : prev);
                    }}
                    className="flex items-center gap-2 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--ink)] py-2 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Another Option
                  </button>
                </div>

                <div className="mt-12 pt-6 border-t border-[var(--edge)] flex items-center justify-between">
                  <button onClick={handleDeleteQuestion} disabled={isSaving} className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete Question
                  </button>
                  <button onClick={handleSaveQuestion} disabled={isSaving} className="action-chip px-8 flex items-center gap-2">
                    <Save className="w-4 h-4" /> {isSaving ? "Saving..." : "Save Question"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </section>
      </main>
    </div>
  );
}
