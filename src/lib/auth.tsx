import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { setTeacherContext, track, trackNow } from "./analytics";
import { errorMessage } from "./errors";
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

const AUTH_TIMEOUT_MS = 20_000;

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

function elapsedMs(startedAt: number): number {
  return Math.round(performance.now() - startedAt);
}

function emailDomain(email: string): string | undefined {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at < 0 || at === trimmed.length - 1) return undefined;
  return trimmed.slice(at + 1).toLowerCase();
}

function authErrorProps(error: unknown): Record<string, unknown> {
  if (error == null) return { error: "unknown" };
  if (typeof error === "object") {
    const e = error as {
      message?: unknown;
      name?: unknown;
      status?: unknown;
      code?: unknown;
    };
    const props: Record<string, unknown> = {
      error: typeof e.message === "string" ? e.message : errorMessage(error),
    };
    if (typeof e.name === "string") props.error_name = e.name;
    if (typeof e.code === "string") props.error_code = e.code;
    if (typeof e.status === "number") props.error_status = e.status;
    return props;
  }
  return { error: String(error) };
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => {
      reject(new Error(`${label} timed out after ${AUTH_TIMEOUT_MS}ms`));
    }, AUTH_TIMEOUT_MS);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        globalThis.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [identity, setIdentity] = useState(emptyIdentity);

  useEffect(() => {
    if (!supabase) {
      trackNow("auth_session_restore_finished", {
        ok: false,
        has_session: false,
        error: "Login is not configured yet.",
        error_code: "not_configured",
        duration_ms: 0,
      });
      setLoading(false);
      return;
    }

    let active = true;
    const startedAt = performance.now();

    withTimeout(supabase.auth.getSession(), "session restore")
      .then(({ data, error }) => {
        const duration_ms = elapsedMs(startedAt);
        if (error) {
          trackNow("auth_session_restore_finished", {
            ok: false,
            has_session: Boolean(data.session),
            duration_ms,
            ...authErrorProps(error),
          });
        } else {
          trackNow("auth_session_restore_finished", {
            ok: true,
            has_session: Boolean(data.session),
            duration_ms,
          });
        }
        if (!active) return;
        setSession(data.session);
        if (!data.session) setLoading(false);
      })
      .catch((error: unknown) => {
        trackNow("auth_session_restore_finished", {
          ok: false,
          has_session: false,
          duration_ms: elapsedMs(startedAt),
          ...authErrorProps(error),
        });
        if (!active) return;
        setLoading(false);
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
    let settled = false;
    let timedOut = false;
    const startedAt = performance.now();
    setLoading(true);

    const timer = globalThis.setTimeout(() => {
      if (settled || !active) return;
      timedOut = true;
      trackNow("auth_profile_finished", {
        ok: false,
        has_profile: false,
        duration_ms: elapsedMs(startedAt),
        error: `profile lookup timed out after ${AUTH_TIMEOUT_MS}ms`,
        error_code: "timeout",
      });
      setLoading(false);
    }, AUTH_TIMEOUT_MS);

    void Promise.resolve(
      supabase
        .from("profiles")
        .select("id, role, display_name, student_id, teacher_id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle(),
    )
      .then(({ data, error }) => {
        if (!active) return;
        const late = timedOut;
        settled = true;
        globalThis.clearTimeout(timer);
        const duration_ms = elapsedMs(startedAt);
        if (error) {
          trackNow("auth_profile_finished", {
            ok: false,
            has_profile: false,
            late,
            duration_ms,
            ...authErrorProps(error),
          });
          setIdentity(emptyIdentity());
          setLoading(false);
          return;
        }
        const row = data as ProfileRow | null;
        if (!row) {
          trackNow("auth_profile_finished", {
            ok: true,
            has_profile: false,
            late,
            duration_ms,
          });
          setIdentity(emptyIdentity());
          setLoading(false);
          return;
        }
        trackNow("auth_profile_finished", {
          ok: true,
          has_profile: true,
          late,
          duration_ms,
          role: row.role,
          teacher_id: row.teacher_id,
          student_id: row.student_id,
        });
        setIdentity({
          role: row.role,
          profileId: row.id,
          displayName: row.display_name,
          teacherId: row.teacher_id,
          teacherName: row.teacher_id ? row.display_name : null,
          studentId: row.student_id,
        });
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const late = timedOut;
        settled = true;
        globalThis.clearTimeout(timer);
        trackNow("auth_profile_finished", {
          ok: false,
          has_profile: false,
          late,
          duration_ms: elapsedMs(startedAt),
          ...authErrorProps(error),
        });
        setIdentity(emptyIdentity());
        setLoading(false);
      });

    return () => {
      active = false;
      globalThis.clearTimeout(timer);
    };
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      recovery,
      ...identity,
      async signIn(email, password) {
        const startedAt = performance.now();
        let settled = false;
        const finish = (ok: boolean, extra: Record<string, unknown> = {}) => {
          if (settled) return;
          settled = true;
          trackNow("auth_sign_in_finished", {
            ok,
            duration_ms: elapsedMs(startedAt),
            email_domain: emailDomain(email),
            ...extra,
          });
        };
        try {
          if (!supabase) {
            finish(false, {
              error: "Login is not configured yet.",
              error_code: "not_configured",
            });
            return "Login is not configured yet.";
          }
          const { data, error } = await withTimeout(
            supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            }),
            "sign in",
          );
          if (error) {
            finish(false, authErrorProps(error));
            return error.message;
          }
          finish(true, { has_session: Boolean(data.session) });
          return null;
        } catch (error: unknown) {
          finish(false, authErrorProps(error));
          return errorMessage(error, "Sign in failed.");
        }
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
        const startedAt = performance.now();
        let settled = false;
        const finish = (ok: boolean, extra: Record<string, unknown> = {}) => {
          if (settled) return;
          settled = true;
          trackNow("auth_reset_finished", {
            ok,
            duration_ms: elapsedMs(startedAt),
            email_domain: emailDomain(email),
            ...extra,
          });
        };
        try {
          if (!supabase) {
            finish(false, {
              error: "Login is not configured yet.",
              error_code: "not_configured",
            });
            return "Login is not configured yet.";
          }
          const origin = window.location.origin;
          const { error } = await withTimeout(
            supabase.auth.resetPasswordForEmail(email.trim(), {
              redirectTo: `${origin}/login`,
            }),
            "password reset",
          );
          if (error) {
            finish(false, authErrorProps(error));
            return error.message;
          }
          finish(true);
          return null;
        } catch (error: unknown) {
          finish(false, authErrorProps(error));
          return errorMessage(error, "Password reset failed.");
        }
      },
      async updatePassword(password) {
        const startedAt = performance.now();
        let settled = false;
        const finish = (ok: boolean, extra: Record<string, unknown> = {}) => {
          if (settled) return;
          settled = true;
          trackNow("auth_password_update_finished", {
            ok,
            duration_ms: elapsedMs(startedAt),
            ...extra,
          });
        };
        try {
          if (!supabase) {
            finish(false, {
              error: "Login is not configured yet.",
              error_code: "not_configured",
            });
            return "Login is not configured yet.";
          }
          const { error } = await withTimeout(
            supabase.auth.updateUser({ password }),
            "password update",
          );
          if (error) {
            finish(false, authErrorProps(error));
            return error.message;
          }
          finish(true);
          setRecovery(false);
          return null;
        } catch (error: unknown) {
          finish(false, authErrorProps(error));
          return errorMessage(error, "Password update failed.");
        }
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
