import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const AUTH_OPTIONS = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

export function bearerToken(req: Request): string {
  return (req.headers.get("Authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

function jwtSub(jwt: string): string | null {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const padded = part
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { sub?: unknown };
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}

export function authedClients(req: Request): {
  userClient: SupabaseClient;
  admin: SupabaseClient;
  jwt: string;
} {
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = bearerToken(req);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: AUTH_OPTIONS,
  });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: AUTH_OPTIONS,
  });
  return { userClient, admin, jwt };
}

/**
 * The functions gateway already verified the JWT (verify_jwt). Auth GET /user
 * can still 403 session_not_found while PostgREST accepts the same token, so
 * do not require a live auth.sessions row.
 */
export async function callerUserId(
  userClient: SupabaseClient,
  jwt: string,
): Promise<string | null> {
  if (!jwt) return null;
  try {
    const { data } = await userClient.auth.getClaims(jwt);
    const sub = (data?.claims as { sub?: unknown } | undefined)?.sub;
    if (typeof sub === "string" && sub) return sub;
  } catch {
    /* older clients, or HS256 getClaims falling through to GET /user */
  }
  return jwtSub(jwt);
}
