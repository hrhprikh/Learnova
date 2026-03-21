"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthState } from "@/components/auth-provider";

type ProtectedPageProps = {
  children: React.ReactNode;
};

export function ProtectedPage({ children }: ProtectedPageProps) {
  const router = useRouter();
  const { user, isLoading } = useAuthState();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
    return <div className="p-8 text-[var(--ink)]">Checking session...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
