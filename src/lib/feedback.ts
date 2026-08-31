import { SUPABASE_ANON_KEY, functionsUrl, supabase } from "./supabase";

export type FeedbackKind = "bug" | "feature" | "general";

export async function sendFeedback(
  kind: FeedbackKind,
  message: string,
): Promise<string | null> {
  if (!functionsUrl || !SUPABASE_ANON_KEY) {
    return "Feedback is not configured yet.";
  }
  const session = supabase
    ? (await supabase.auth.getSession()).data.session
    : null;
  const accessToken = session?.access_token ?? SUPABASE_ANON_KEY;
  const response = await fetch(`${functionsUrl}/send-feedback`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind, message: message.trim() }),
  });
  let payload: { error?: unknown } = {};
  try {
    payload = (await response.json()) as { error?: unknown };
  } catch {
    /* ignore */
  }
  const fromBody =
    typeof payload.error === "string" && payload.error ? payload.error : null;
  if (!response.ok) {
    return fromBody ?? `Could not send feedback (${response.status}).`;
  }
  return fromBody;
}
