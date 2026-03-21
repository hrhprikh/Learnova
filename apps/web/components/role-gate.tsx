"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProtectedPage } from "@/components/protected-page";

type Role = "ADMIN" | "INSTRUCTOR" | "LEARNER";

type RoleGateProps = {
  role: Role | null;
  allow: Role[];
  fallbackPath?: string;
  children: React.ReactNode;
};

export function RoleGate({ role, allow, fallbackPath = "/dashboard", children }: RoleGateProps) {
  const router = useRouter();

  useEffect(() => {
    if (role && !allow.includes(role)) {
      router.replace(fallbackPath);
    }
  }, [role, allow, fallbackPath, router]);

  if (!role) {
    return (
      <ProtectedPage>
        <div className="p-8 text-brand-700">Resolving role access...</div>
      </ProtectedPage>
    );
  }

  return <ProtectedPage>{children}</ProtectedPage>;
}
