"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest } from "@/lib/api";
import { signInWithPassword } from "@/lib/supabase-auth";

type SyncUserResponse = {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: "ADMIN" | "INSTRUCTOR" | "LEARNER";
  };
};

type MeResponse = {
  user: {
    role: "ADMIN" | "INSTRUCTOR" | "LEARNER";
  } | null;
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: signInError } = await signInWithPassword(email, password);
      if (signInError) {
        throw signInError;
      }

      const userEmail = data.user?.email;
      const accessToken = data.session?.access_token;
      if (!userEmail) {
        throw new Error("Could not resolve user email from session.");
      }
      if (!accessToken) {
        throw new Error("Could not resolve access token from session.");
      }

      await apiRequest<SyncUserResponse>("/auth/sync-user", {
        method: "POST",
        token: accessToken,
        body: {
          fullName: buildSafeFullName(
            typeof data.user?.user_metadata?.full_name === "string"
              ? data.user.user_metadata.full_name
              : undefined,
            userEmail
          )
        }
      });

      const me = await apiRequest<MeResponse>("/users/me", { token: accessToken });
      if (!me.user) {
        throw new Error("Could not resolve user profile after sign-in.");
      }

      const destination = me.user.role === "ADMIN" || me.user.role === "INSTRUCTOR"
        ? "/backoffice"
        : "/dashboard";

      router.replace(destination);
      router.refresh();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Login failed";
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
          <Link href="/register" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">Register</Link>
        </nav>
      </header>

      <main className="max-w-[1100px] mx-auto pt-36 px-6 lg:px-12 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="bg-white border border-[var(--edge)] rounded-3xl p-8 lg:p-10">
          <p className="mono-note">auth flow</p>
          <h1 className="font-heading text-5xl lg:text-6xl leading-[1.05] mt-4">Welcome back.</h1>
          <p className="text-[var(--ink-soft)] mt-4 max-w-md leading-relaxed">
            Login routes you by role: learner to dashboard, instructor/admin to the instructor panel.
          </p>
        </section>

        <form onSubmit={onSubmit} className="bg-white border border-[var(--edge)] rounded-3xl p-8 space-y-4">
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
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <p className="body-copy text-xs">
            Learners and instructors can sign up directly.
          </p>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button type="submit" disabled={isSubmitting} className="action-chip w-full">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
          <p className="text-[var(--ink-soft)] text-sm">
            New user? <Link href="/register" className="floating-link">Create account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
