import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { setTeacherContext, track } from "./analytics";
import { supabase } from "./supabase";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  teacherId: string | null;
  teacherName: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    if (!session) {
      setTeacherId(null);
      setTeacherName(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    supabase
      .from("teachers")
      .select("id, name")
      .eq("auth_user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setTeacherId(data?.id ?? null);
        setTeacherName(data?.name ?? null);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      teacherId,
      teacherName,
      async signIn(email, password) {
        if (!supabase) return "Teacher login is not configured yet.";
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return error?.message ?? null;
      },
      async signOut() {
        track("teacher_signed_out", { teacher_id: teacherId });
        setTeacherContext(null);
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      async resetPassword(email) {
        if (!supabase) return "Teacher login is not configured yet.";
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: window.location.origin },
        );
        return error?.message ?? null;
      },
    }),
    [loading, session, teacherId, teacherName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return value;
}
