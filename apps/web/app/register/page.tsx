"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";
import { signInWithPassword, signUpWithPassword } from "@/lib/supabase-auth";

type SyncUserResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: "ADMIN" | "INSTRUCTOR" | "LEARNER";
  };
};

function buildSafeFullName(candidate: string | null | undefined, email: string): string {
  const trimmed = (candidate ?? "").trim();
  if (trimmed.length >= 2) {
    return trimmed;
  }

  const fallbackFromEmail = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  if (fallbackFromEmail.length >= 2) {
    return fallbackFromEmail;
  }

  return "Learner User";
}

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"LEARNER" | "INSTRUCTOR">("LEARNER");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: signUpError } = await signUpWithPassword(email, password, fullName);

      if (signUpError) {
        throw signUpError;
      }

      const userEmail = data.user?.email;
      if (!userEmail) {
        throw new Error("Signup succeeded but user email was not returned.");
      }

      let accessToken = data.session?.access_token;

      if (!accessToken) {
        const signInFallback = await signInWithPassword(email, password);
        if (signInFallback.error) {
          throw signInFallback.error;
        }
        accessToken = signInFallback.data.session?.access_token;
      }

      if (accessToken) {
        await apiRequest<SyncUserResponse>("/auth/sync-user", {
          method: "POST",
          token: accessToken,
          body: {
            fullName: buildSafeFullName(fullName, userEmail),
            role: accountType
          }
        });
        const destination = accountType === "INSTRUCTOR" ? "/backoffice" : "/dashboard";
        router.replace(destination);
        router.refresh();
      } else {
        throw new Error("Account created but no active session was returned. Please sign in.");
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Registration failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-20">
      <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[1100px] z-50 bg-white/70 backdrop-blur-xl border border-[var(--edge)] px-6 py-4 rounded-2xl shadow-[0_10px_30px_-20px_rgba(0,0,0,0.1)] flex items-center justify-between">
        <span className="font-heading font-semibold tracking-tight text-lg text-[var(--ink)]">Learnova</span>
        <nav className="flex gap-4 font-mono text-xs">
          <Link href="/" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">Home</Link>
          <Link href="/login" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">Login</Link>
        </nav>
      </header>

      <main className="max-w-[1100px] mx-auto pt-36 px-6 lg:px-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="bg-white border border-[var(--edge)] rounded-3xl p-8 lg:p-10">
          <p className="mono-note">onboarding</p>
          <h1 className="font-heading text-5xl lg:text-6xl leading-[1.05] mt-4">Create your Learnova profile.</h1>
          <p className="text-[var(--ink-soft)] mt-4 max-w-md leading-relaxed">
            Choose learner or instructor account type at signup.
          </p>
        </section>

        <form onSubmit={onSubmit} className="bg-white border border-[var(--edge)] rounded-3xl p-8 space-y-4">
          <label className="block text-sm font-medium text-[var(--ink)]">
            Full name
            <input
              className="mt-1 w-full rounded-xl border border-[var(--edge)] bg-white px-3 py-2 outline-none"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink)]">
            Email
            <input
              className="mt-1 w-full rounded-xl border border-[var(--edge)] bg-white px-3 py-2 outline-none"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink)]">
            Password
            <input
              className="mt-1 w-full rounded-xl border border-[var(--edge)] bg-white px-3 py-2 outline-none"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          <p className="body-copy text-xs">
            Admin role cannot be self-assigned from public signup.
          </p>
          <fieldset>
            <legend className="text-sm font-medium text-[var(--ink)]">Account type</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--edge)] bg-white px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="accountType"
                  value="LEARNER"
                  checked={accountType === "LEARNER"}
                  onChange={() => setAccountType("LEARNER")}
                />
                Learner
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--edge)] bg-white px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="accountType"
                  value="INSTRUCTOR"
                  checked={accountType === "INSTRUCTOR"}
                  onChange={() => setAccountType("INSTRUCTOR")}
                />
                Instructor
              </label>
            </div>
          </fieldset>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={isSubmitting} className="action-chip w-full">
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
          <p className="text-[var(--ink-soft)] text-sm">
            Already have an account? <Link href="/login" className="floating-link">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
