"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProtectedPage } from "@/components/protected-page";

type Role = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type RoleGateProps = {
  role: Role | null;
  isResolving?: boolean;
  allow: Role[];
  fallbackPath?: string;
  children: React.ReactNode;
};

export function RoleGate({ role, isResolving = false, allow, fallbackPath = "/dashboard", children }: RoleGateProps) {
  const router = useRouter();
  const resolving = isResolving || role === null;

  useEffect(() => {
    if (!resolving && !role) {
      router.replace("/login");
      return;
    }

    if (!resolving && role && !allow.includes(role)) {
      router.replace(fallbackPath);
    }
  }, [role, resolving, allow, fallbackPath, router]);

  if (resolving) {
    return (
      <ProtectedPage>
        <div className="p-8 text-brand-700">Resolving role access...</div>
      </ProtectedPage>
    );
  }

  if (!role) {
    return null;
  }

  return <ProtectedPage>{children}</ProtectedPage>;
}
