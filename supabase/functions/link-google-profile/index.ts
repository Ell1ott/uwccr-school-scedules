import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { rosterByEmail } from "../_shared/roster.ts";
import { staffByEmail } from "../_shared/staffEmails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Role = "student" | "staff";

function log(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(email: string | undefined): string | null {
  const trimmed = email?.trim().toLowerCase() ?? "";
  return trimmed.includes("@") ? trimmed : null;
}

async function remountByEmail(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string,
) {
  await admin.from("students").update({ auth_user_id: userId }).eq("email", email);
  await admin.from("teachers").update({ auth_user_id: userId }).eq("email", email);
  const { data, error } = await admin
    .from("profiles")
    .update({ auth_user_id: userId })
    .eq("email", email)
    .select("id, role, display_name, student_id, teacher_id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const admin = createClient(supabaseUrl, serviceKey);

  const {
    data: { user },
    error: userError,
  } = jwt
    ? await userClient.auth.getUser(jwt)
    : await userClient.auth.getUser();
  if (userError || !user) {
    log("auth_failed", { error: userError?.message ?? "no user", has_jwt: Boolean(jwt) });
    return json({ error: "Unauthorized" }, 401);
  }

  const email = normalizeEmail(user.email);
  if (!email) {
    log("missing_email", { user_id: user.id });
    return json({ linked: false, error: "This Google account has no email." }, 400);
  }

  log("link_start", { user_id: user.id, email });

  const existing = await admin
    .from("profiles")
    .select("id, role, display_name, student_id, teacher_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (existing.error) {
    log("profile_lookup_error", { error: existing.error.message });
    return json({ error: existing.error.message }, 400);
  }
  if (existing.data) {
    return json({ linked: true, already: true, profile: existing.data });
  }

  try {
    const remounted = await remountByEmail(admin, user.id, email);
    if (remounted) {
      log("remounted", { user_id: user.id, email, role: remounted.role });
      return json({ linked: true, remounted: true, profile: remounted });
    }

    const { data: student, error: studentError } = await admin
      .from("students")
      .select("id, name, cohort, email")
      .eq("email", email)
      .maybeSingle();
    if (studentError) throw studentError;

    if (student) {
      const { error: studentLinkError } = await admin.from("students").update({
        auth_user_id: user.id,
      }).eq("id", student.id);
      if (studentLinkError) throw studentLinkError;
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            role: "student" satisfies Role,
            email,
            display_name: student.name,
            student_id: student.id,
            teacher_id: null,
          },
          { onConflict: "auth_user_id" },
        )
        .select("id, role, display_name, student_id, teacher_id")
        .single();
      if (profileError) throw profileError;
      log("linked_student_row", { user_id: user.id, student_id: student.id });
      return json({ linked: true, created: true, profile });
    }

    const { data: teacher, error: teacherError } = await admin
      .from("teachers")
      .select("id, name, email")
      .eq("email", email)
      .maybeSingle();
    if (teacherError) throw teacherError;

    if (teacher) {
      const { error: teacherLinkError } = await admin.from("teachers").update({
        auth_user_id: user.id,
      }).eq("id", teacher.id);
      if (teacherLinkError) throw teacherLinkError;
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            role: "staff" satisfies Role,
            email,
            display_name: teacher.name,
            student_id: null,
            teacher_id: teacher.id,
          },
          { onConflict: "auth_user_id" },
        )
        .select("id, role, display_name, student_id, teacher_id")
        .single();
      if (profileError) throw profileError;
      log("linked_teacher_row", { user_id: user.id, teacher_id: teacher.id });
      return json({ linked: true, created: true, profile });
    }

    const roster = rosterByEmail(email);
    if (roster) {
      const { error: studentUpsertError } = await admin.from("students").upsert({
        id: roster.id,
        name: roster.name,
        cohort: roster.cohort,
        email,
        auth_user_id: user.id,
      });
      if (studentUpsertError) throw studentUpsertError;
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            role: "student" satisfies Role,
            email,
            display_name: roster.name,
            student_id: roster.id,
            teacher_id: null,
          },
          { onConflict: "auth_user_id" },
        )
        .select("id, role, display_name, student_id, teacher_id")
        .single();
      if (profileError) throw profileError;
      log("linked_roster", { user_id: user.id, student_id: roster.id });
      return json({ linked: true, created: true, profile });
    }

    const staff = staffByEmail(email);
    if (staff) {
      const { error: teacherUpsertError } = await admin.from("teachers").upsert({
        id: staff.id,
        name: staff.name,
        email,
        auth_user_id: user.id,
      });
      if (teacherUpsertError) throw teacherUpsertError;
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .upsert(
          {
            auth_user_id: user.id,
            role: "staff" satisfies Role,
            email,
            display_name: staff.name,
            student_id: null,
            teacher_id: staff.id,
          },
          { onConflict: "auth_user_id" },
        )
        .select("id, role, display_name, student_id, teacher_id")
        .single();
      if (profileError) throw profileError;
      log("linked_staff_map", { user_id: user.id, teacher_id: staff.id });
      return json({ linked: true, created: true, profile });
    }

    log("unlinked", { user_id: user.id, email });
    return json({ linked: false });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    log("link_failed", { user_id: user.id, email, error: message });
    return json({ linked: false, error: message }, 400);
  }
});
