"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentSession, onAuthStateChange } from "@/lib/supabase-auth";

type SessionUser = {
  id: string;
  email: string;
};

type AuthState = {
  isLoading: boolean;
  user: SessionUser | null;
};

export function useAuthState() {
  const [state, setState] = useState<AuthState>({ isLoading: true, user: null });

  useEffect(() => {
    let mounted = true;

    getCurrentSession().then(({ data }) => {
      if (!mounted) return;
      const user = data.session?.user;
      setState({
        isLoading: false,
        user: user?.email ? { id: user.id, email: user.email } : null
      });
    });

    const {
      data: { subscription }
    } = onAuthStateChange((_event, session) => {
      const user = session?.user;
      setState({
        isLoading: false,
        user: user?.email ? { id: user.id, email: user.email } : null
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return useMemo(() => state, [state]);
}
