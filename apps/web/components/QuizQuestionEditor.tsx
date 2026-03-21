"use client";

import { useState, useEffect } from "react";
import { Plus, CheckCircle2, Circle, Trash2, HelpCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

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
  questions: Question[];
};

interface QuizQuestionEditorProps {
  quizId: string;
  token: string;
}

export default function QuizQuestionEditor({ quizId, token }: QuizQuestionEditorProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [questionEdit, setQuestionEdit] = useState<Question | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuiz() {
      try {
        const response = await apiRequest<{ quiz: Quiz }>(`/quizzes/${quizId}`, { token });
        setQuiz(response.quiz);
        if (response.quiz.questions && response.quiz.questions.length > 0) {
          const firstId = response.quiz.questions[0]?.id;
          if (firstId) setSelectedQuestionId(firstId);
        }
      } catch (err) {
        console.error("Failed to load quiz", err);
      } finally {
        setLoading(false);
      }
    }
    loadQuiz();
  }, [quizId, token]);

  useEffect(() => {
    if (selectedQuestionId && quiz) {
      const q = quiz.questions.find(q => q.id === selectedQuestionId);
      if (q) {
        setQuestionEdit(JSON.parse(JSON.stringify(q)));
      }
    }
  }, [selectedQuestionId, quiz]);

  const handleAddQuestion = async () => {
    try {
      const response = await apiRequest<{ question: Question }>(`/quizzes/${quizId}/questions`, {
        method: "POST",
        token,
        body: { text: "New Question" }
      });
      if (quiz) {
        setQuiz({ ...quiz, questions: [...quiz.questions, response.question] });
      }
      setSelectedQuestionId(response.question.id);
    } catch {
      alert("Failed to add question");
    }
  };

  const handleSaveQuestion = async () => {
    if (!questionEdit || isSaving) return;
    if (!questionEdit.text.trim()) return alert("Question text cannot be empty");
    if (questionEdit.options.length < 2) return alert("Must have at least 2 options");
    if (!questionEdit.options.some(o => o.isCorrect)) return alert("Must select at least one correct option");

    setIsSaving(true);
    try {
      const response = await apiRequest<{ question: Question }>(`/quizzes/${quizId}/questions/${questionEdit.id}`, {
        method: "PUT",
        token,
        body: { text: questionEdit.text, options: questionEdit.options }
      });
      if (quiz) {
        setQuiz({
          ...quiz,
          questions: quiz.questions.map(q => q.id === questionEdit.id ? response.question : q)
        });
      }
      alert("Question saved!");
    } catch {
      alert("Failed to save question");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!questionEdit || !confirm("Delete this question?")) return;
    try {
      await apiRequest(`/quizzes/${quizId}/questions/${questionEdit.id}`, { method: "DELETE", token });
      if (quiz) {
        const updated = quiz.questions.filter(q => q.id !== questionEdit.id);
        setQuiz({ ...quiz, questions: updated });
        setSelectedQuestionId(updated.length > 0 ? (updated[0]?.id || null) : null);
        if (updated.length === 0) setQuestionEdit(null);
      }
    } catch {
      alert("Failed to delete question");
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--ink-soft)] font-mono text-sm">Loading Questions...</div>;

  return (
    <div className="flex h-[60vh] bg-white rounded-3xl border border-[var(--edge)] overflow-hidden shadow-sm">
      {/* Sidebar */}
      <div className="w-64 border-r border-[var(--edge)] flex flex-col bg-[#fcfbfa]">
        <div className="p-4 border-b border-[var(--edge)]">
          <button 
            onClick={handleAddQuestion}
            className="w-full py-2 px-4 rounded-xl border border-dashed border-[var(--edge)] text-xs font-bold hover:bg-white hover:border-[var(--ink)] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-3 h-3" /> New Question
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {quiz?.questions?.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setSelectedQuestionId(q.id)}
              className={`w-full text-left p-3 rounded-xl transition-all ${selectedQuestionId === q.id ? "bg-white shadow-sm ring-1 ring-[var(--edge)]" : "hover:bg-white/50 text-[var(--ink-soft)]"}`}
            >
              <div className="flex gap-2">
                <span className="font-mono text-[10px] opacity-40 mt-1">{String(idx + 1).padStart(2, '0')}</span>
                <p className="text-xs font-medium truncate">{q.text || "Untilted Question"}</p>
              </div>
            </button>
          ))}
          {(!quiz?.questions || quiz.questions.length === 0) && (
             <div className="p-8 text-center bg-white/50 rounded-2xl m-2">
                <HelpCircle className="w-8 h-8 text-[var(--edge)] mx-auto mb-2" />
                <p className="text-[10px] text-[var(--ink-soft)]">No questions added</p>
             </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        {questionEdit ? (
          <>
            <div className="p-8 space-y-6 flex-1 overflow-y-auto">
              <textarea 
                className="w-full text-xl font-medium bg-transparent outline-none resize-none border-b border-transparent focus:border-[var(--edge)] transition-colors pb-2"
                rows={2}
                placeholder="Question text..."
                value={questionEdit.text}
                onChange={e => setQuestionEdit({...questionEdit, text: e.target.value})}
              />

              <div className="space-y-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--ink-soft)]">Options</p>
                {questionEdit.options.map((opt, idx) => (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${opt.isCorrect ? "bg-purple-50 border-purple-200" : "bg-white border-[var(--edge)]"}`}>
                    <button 
                      onClick={() => {
                        setQuestionEdit(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            options: prev.options.map((o, i) => i === idx ? { ...o, isCorrect: !o.isCorrect } : o)
                          };
                        });
                      }}
                      className="shrink-0"
                    >
                      {opt.isCorrect ? <CheckCircle2 className="w-5 h-5 text-purple-600" /> : <Circle className="w-5 h-5 text-[var(--edge)]" />}
                    </button>
                    <input 
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium"
                      placeholder={`Option ${idx + 1}`}
                      value={opt.text}
                      onChange={e => {
                        const val = e.target.value;
                        setQuestionEdit(prev => {
                           if (!prev) return null;
                           return {
                             ...prev,
                             options: prev.options.map((o, i) => i === idx ? { ...o, text: val } : o)
                           };
                        });
                      }}
                    />
                    <button 
                      onClick={() => {
                        setQuestionEdit(prev => {
                          if (!prev) return null;
                          return {
                            ...prev,
                            options: prev.options.filter((_, i) => i !== idx)
                          };
                        });
                      }}
                      className="text-[var(--edge)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => setQuestionEdit(prev => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      options: [...prev.options, { text: "", isCorrect: false }]
                    };
                  })}
                  className="flex items-center gap-2 text-[10px] font-bold text-purple-600 hover:text-purple-700 mt-2"
                >
                  <Plus className="w-3 h-3" /> ADD OPTION
                </button>
              </div>
            </div>
            
            <div className="p-6 border-t border-[var(--edge)] flex items-center justify-between bg-[#fcfbfa]">
               <button onClick={handleDeleteQuestion} className="text-red-500 hover:bg-red-50 p-2 rounded-xl text-xs font-bold transition-colors">Delete Question</button>
               <button onClick={handleSaveQuestion} disabled={isSaving} className="action-chip text-xs px-8 h-10">{isSaving ? "Saving..." : "Save Question"}</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-[var(--ink-soft)] bg-[#fcfbfa]">
             <div className="w-16 h-16 rounded-3xl bg-white shadow-sm flex items-center justify-center mb-4">
                <Plus className="w-8 h-8 opacity-20" />
             </div>
             <p className="text-sm font-medium">Select or add a question to start building your quiz.</p>
          </div>
        )}
      </div>
    </div>
  );
}
