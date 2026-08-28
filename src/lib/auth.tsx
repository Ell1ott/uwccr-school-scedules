import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { setTeacherContext, track } from "./analytics";
import { supabase } from "./supabase";

export type AuthRole = "student" | "staff";

export type AuthState = {
  loading: boolean;
  session: Session | null;
  recovery: boolean;
  role: AuthRole | null;
  profileId: string | null;
  displayName: string | null;
  teacherId: string | null;
  teacherName: string | null;
  studentId: string | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
};

type ProfileRow = {
  id: string;
  role: AuthRole;
  display_name: string;
  student_id: string | null;
  teacher_id: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

function emptyIdentity() {
  return {
    role: null as AuthRole | null,
    profileId: null as string | null,
    displayName: null as string | null,
    teacherId: null as string | null,
    teacherName: null as string | null,
    studentId: null as string | null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [identity, setIdentity] = useState(emptyIdentity);

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
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") setRecovery(false);
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
      setIdentity(emptyIdentity());
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, role, display_name, student_id, teacher_id")
      .eq("auth_user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const row = data as ProfileRow | null;
        if (!row) {
          setIdentity(emptyIdentity());
          setLoading(false);
          return;
        }
        setIdentity({
          role: row.role,
          profileId: row.id,
          displayName: row.display_name,
          teacherId: row.teacher_id,
          teacherName: row.teacher_id ? row.display_name : null,
          studentId: row.student_id,
        });
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
      recovery,
      ...identity,
      async signIn(email, password) {
        if (!supabase) return "Login is not configured yet.";
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        return error?.message ?? null;
      },
      async signOut() {
        track("signed_out", {
          role: identity.role,
          teacher_id: identity.teacherId,
          student_id: identity.studentId,
        });
        setTeacherContext(null);
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      async resetPassword(email) {
        if (!supabase) return "Login is not configured yet.";
        const origin = window.location.origin;
        const { error } = await supabase.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: `${origin}/?view=login` },
        );
        return error?.message ?? null;
      },
      async updatePassword(password) {
        if (!supabase) return "Login is not configured yet.";
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return error.message;
        setRecovery(false);
        return null;
      },
    }),
    [loading, session, recovery, identity],
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
