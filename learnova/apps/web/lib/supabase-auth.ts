import { supabase } from "@/lib/supabase";

type AuthChangeEvent = string;

type User = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type Session = {
  access_token: string;
  user: User;
};

type AuthSubscription = {
  unsubscribe: () => void;
};

type AuthFacade = {
  signInWithPassword: (credentials: { email: string; password: string }) => Promise<{
    data: { user: User | null; session: Session | null };
    error: Error | null;
  }>;
  signUp: (payload: {
    email: string;
    password: string;
    options?: { data?: Record<string, unknown> };
  }) => Promise<{
    data: { user: User | null; session: Session | null };
    error: Error | null;
  }>;
  getSession: () => Promise<{ data: { session: Session | null }; error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: Session | null) => void
  ) => { data: { subscription: AuthSubscription } };
};

const auth = supabase.auth as unknown as AuthFacade;

export async function signInWithPassword(email: string, password: string) {
  return auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  return auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });
}

export async function getCurrentSession() {
  return auth.getSession();
}

export async function signOutSession() {
  return auth.signOut();
}

export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
) {
  return auth.onAuthStateChange(callback);
}
