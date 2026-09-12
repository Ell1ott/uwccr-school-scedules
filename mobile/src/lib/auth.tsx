import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { track, trackNow } from "./analytics";
import { errorMessage } from "@shared/lib/errors";
import { SUPABASE_ANON_KEY, functionsUrl, supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

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
  signInWithGoogle: () => Promise<string | null>;
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
const redirectTo = makeRedirectUri({
  scheme: "uwccr",
  path: "auth",
  native: "uwccr://auth",
});

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

async function fetchProfile(authUserId: string): Promise<{
  data: ProfileRow | null;
  error: { message?: string } | null;
}> {
  if (!supabase) {
    return { data: null, error: { message: "Login is not configured yet." } };
  }
  const result = await supabase
    .from("profiles")
    .select("id, role, display_name, student_id, teacher_id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  return {
    data: (result.data as ProfileRow | null) ?? null,
    error: result.error,
  };
}

async function linkGoogleProfile(accessToken: string): Promise<{
  linked: boolean;
  error?: string;
}> {
  if (!functionsUrl) return { linked: false, error: "Login is not configured yet." };
  const response = await fetch(`${functionsUrl}/link-google-profile`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
  });
  let payload: { linked?: boolean; error?: unknown } = {};
  try {
    payload = (await response.json()) as { linked?: boolean; error?: unknown };
  } catch {
    /* ignore */
  }
  if (!response.ok) {
    const message =
      typeof payload.error === "string" && payload.error
        ? payload.error
        : "Could not link this Google account.";
    return { linked: false, error: message };
  }
  return { linked: Boolean(payload.linked) };
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

function readCallbackParam(url: string, key: string): string | null {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get(key) ??
      new URLSearchParams(parsed.hash.replace(/^#/, "")).get(key)
    );
  } catch {
    const query = url.split("?")[1]?.split("#")[0] ?? "";
    const hash = url.split("#")[1] ?? "";
    return (
      new URLSearchParams(query).get(key) ?? new URLSearchParams(hash).get(key)
    );
  }
}

export async function createSessionFromUrl(url: string) {
  if (!supabase || !url) return null;
  const error =
    readCallbackParam(url, "error_description") ??
    readCallbackParam(url, "error") ??
    readCallbackParam(url, "error_code");
  if (error) throw new Error(error);

  const code = readCallbackParam(url, "code");
  if (code) {
    const { data, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return data.session;
  }

  const accessToken = readCallbackParam(url, "access_token");
  const refreshToken = readCallbackParam(url, "refresh_token");
  if (accessToken && refreshToken) {
    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return data.session;
  }

  return null;
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
    withTimeout(supabase.auth.getSession(), "session restore")
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        if (!data.session) setLoading(false);
      })
      .catch(() => {
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

    const handleUrl = (url: string | null) => {
      if (!url) return;
      void createSessionFromUrl(url).catch(() => {
        /* invalid or already-exchanged callback */
      });
    };
    void Linking.getInitialURL().then(handleUrl);
    const linking = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => {
      active = false;
      subscription.unsubscribe();
      linking.remove();
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
    const startedAt = performance.now();
    setLoading(true);
    const timer = globalThis.setTimeout(() => {
      if (settled || !active) return;
      setLoading(false);
    }, AUTH_TIMEOUT_MS);

    void Promise.resolve(fetchProfile(session.user.id))
      .then(async ({ data, error }) => {
        if (!active) return;
        let row = data;
        if (!error && !row) {
          const linked = await linkGoogleProfile(session.access_token);
          if (linked.linked) {
            const again = await fetchProfile(session.user.id);
            row = again.data;
          }
        }
        if (!active) return;
        settled = true;
        globalThis.clearTimeout(timer);
        trackNow("auth_profile_finished", {
          ok: Boolean(row),
          duration_ms: elapsedMs(startedAt),
        });
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
      })
      .catch(() => {
        if (!active) return;
        settled = true;
        globalThis.clearTimeout(timer);
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
      async signInWithGoogle() {
        try {
          if (!supabase) return "Login is not configured yet.";
          const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
              skipBrowserRedirect: true,
              queryParams: {
                prompt: "select_account",
                hd: "uwccostarica.org",
              },
            },
          });
          if (error) return error.message;
          const result = await WebBrowser.openAuthSessionAsync(
            data.url ?? "",
            redirectTo,
          );
          if (result.type === "success" && result.url) {
            await createSessionFromUrl(result.url);
          }
          return null;
        } catch (error: unknown) {
          return errorMessage(error, "Google sign in failed.");
        }
      },
      async signOut() {
        track("signed_out", { role: identity.role });
        if (!supabase) return;
        await supabase.auth.signOut();
      },
      async resetPassword(email) {
        try {
          if (!supabase) return "Login is not configured yet.";
          const { error } = await supabase.auth.resetPasswordForEmail(
            email.trim(),
            { redirectTo },
          );
          if (error) return error.message;
          return null;
        } catch (error: unknown) {
          return errorMessage(error, "Password reset failed.");
        }
      },
      async updatePassword(password) {
        try {
          if (!supabase) return "Login is not configured yet.";
          const { error } = await supabase.auth.updateUser({ password });
          if (error) return error.message;
          setRecovery(false);
          return null;
        } catch (error: unknown) {
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
