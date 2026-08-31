import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

type Role = "staff" | "student";

type PersonInput = {
  name: string;
  email: string;
  role: Role;
  teacherId?: string;
  studentId?: string;
  cohort?: string;
};

type ProvisionResult = {
  emailed: boolean;
  password: string;
  email: string;
  name: string;
  role: Role;
  teacherId?: string;
  studentId?: string;
  error?: string;
  emailError?: string;
};

function log(event: string, details: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...details }));
}

const RESEND_FROM = "UWCCR Schedules <noreply@costarica.uwc.social>";

function resendFrom() {
  const configured = Deno.env.get("RESEND_FROM") ?? "";
  if (configured.includes("@costarica.uwc.social")) return configured;
  return RESEND_FROM;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generatePassword(length = 14) {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function loginEmailHtml(input: {
  name: string;
  email: string;
  password: string;
  appUrl: string;
  role: Role;
}) {
  const loginUrl = `${input.appUrl.replace(/\/$/, "")}/?view=login`;
  const purpose =
    input.role === "student"
      ? "You can log in to Week View to see your events, accept invitations, and join what is open."
      : "You can log in to Week View to create events for students. If you teach, you can still cancel only your own classes.";
  return `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1b1c1d;line-height:1.5">
      <p>Hi ${input.name},</p>
      <p>${purpose}</p>
      <p><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      <p><strong>Email:</strong> ${input.email}<br/>
      <strong>Password:</strong> ${input.password}</p>
      <p>Use Forgot password on the login page if you need a new one. Stay signed in on your phone so you do not have to type this each time.</p>
    </div>
  `;
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  const lower = email.toLowerCase();
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === lower);
    if (match) return match.id;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function sendLoginEmail(
  input: {
    name: string;
    email: string;
    password: string;
    appUrl: string;
    role: Role;
  },
): Promise<{ ok: boolean; error?: string }> {
  const resendKey = Deno.env.get("RESEND_API_KEY") ?? "";
  const fromConfigured = Boolean(Deno.env.get("RESEND_FROM"));
  const from = resendFrom();
  log("email_start", {
    to: input.email,
    role: input.role,
    from,
    from_configured: fromConfigured,
    has_api_key: Boolean(resendKey),
    api_key_len: resendKey.length,
  });
  if (!resendKey) {
    log("email_skip", { reason: "missing_RESEND_API_KEY" });
    return { ok: false, error: "RESEND_API_KEY is not set on the edge function" };
  }
  try {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: "Your UWCCR Week View login",
        html: loginEmailHtml(input),
      }),
    });
    const body = await sent.text();
    log("email_resend_response", {
      to: input.email,
      from,
      status: sent.status,
      ok: sent.ok,
      body: body.slice(0, 500),
    });
    if (!sent.ok) {
      return {
        ok: false,
        error: `Resend ${sent.status}: ${body.slice(0, 300)}`,
      };
    }
    return { ok: true };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    log("email_resend_throw", { to: input.email, error: message });
    return { ok: false, error: message };
  }
}

async function provisionOne(
  admin: ReturnType<typeof createClient>,
  person: PersonInput,
  appUrl: string,
  sendEmail: boolean,
): Promise<ProvisionResult> {
  const email = person.email.trim().toLowerCase();
  const name = person.name.trim();
  const password = generatePassword();
  const metadata =
    person.role === "student"
      ? { student_id: person.studentId, name, role: "student" }
      : { teacher_id: person.teacherId ?? null, name, role: "staff" };

  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const existingId = await findUserIdByEmail(admin, email);
    if (!existingId) {
      return {
        emailed: false,
        password: "",
        email,
        name,
        role: person.role,
        teacherId: person.teacherId,
        studentId: person.studentId,
        error: created.error?.message ?? "Could not create user",
      };
    }
    const updated = await admin.auth.admin.updateUserById(existingId, {
      password,
      email,
      user_metadata: metadata,
    });
    if (updated.error || !updated.data.user) {
      return {
        emailed: false,
        password: "",
        email,
        name,
        role: person.role,
        teacherId: person.teacherId,
        studentId: person.studentId,
        error: updated.error?.message ?? "Could not update user",
      };
    }
    userId = updated.data.user.id;
  }

  if (person.role === "student") {
    const studentId = person.studentId?.trim();
    if (!studentId) {
      return {
        emailed: false,
        password: "",
        email,
        name,
        role: person.role,
        error: "studentId is required",
      };
    }
    const cohort = person.cohort === "IB2" ? "IB2" : "IB1";
    const { error: studentError } = await admin.from("students").upsert({
      id: studentId,
      name,
      cohort,
      email,
      auth_user_id: userId,
    });
    if (studentError) {
      return {
        emailed: false,
        password,
        email,
        name,
        role: person.role,
        studentId,
        error: studentError.message,
      };
    }
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        auth_user_id: userId,
        role: "student",
        email,
        display_name: name,
        student_id: studentId,
        teacher_id: null,
      },
      { onConflict: "auth_user_id" },
    );
    if (profileError) {
      return {
        emailed: false,
        password,
        email,
        name,
        role: person.role,
        studentId,
        error: profileError.message,
      };
    }
  } else {
    if (person.teacherId) {
      const { error: teacherError } = await admin.from("teachers").upsert({
        id: person.teacherId,
        name,
        email,
        auth_user_id: userId,
      });
      if (teacherError) {
        return {
          emailed: false,
          password,
          email,
          name,
          role: person.role,
          teacherId: person.teacherId,
          error: teacherError.message,
        };
      }
    }
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        auth_user_id: userId,
        role: "staff",
        email,
        display_name: name,
        student_id: null,
        teacher_id: person.teacherId ?? null,
      },
      { onConflict: "auth_user_id" },
    );
    if (profileError) {
      return {
        emailed: false,
        password,
        email,
        name,
        role: person.role,
        teacherId: person.teacherId,
        error: profileError.message,
      };
    }
  }

  let emailed = false;
  let emailError: string | undefined;
  if (sendEmail) {
    const sent = await sendLoginEmail({
      name,
      email,
      password,
      appUrl,
      role: person.role,
    });
    emailed = sent.ok;
    emailError = sent.error;
    log("email_result", { to: email, emailed, emailError: emailError ?? null });
  } else {
    log("email_skip", { to: email, reason: "sendEmail_false" });
  }

  return {
    emailed,
    password,
    email,
    name,
    role: person.role,
    teacherId: person.teacherId,
    studentId: person.studentId,
    emailError,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const adminSecret = Deno.env.get("ADMIN_SECRET") ?? "";
  const provided = req.headers.get("x-admin-secret") ?? "";
  if (!adminSecret || provided !== adminSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await req.json() as {
    teacherId?: string;
    studentId?: string;
    name?: string;
    email?: string;
    role?: Role;
    cohort?: string;
    appUrl?: string;
    sendEmail?: boolean;
    students?: { id: string; name: string; email: string; cohort?: string }[];
  };

  const sendEmail = body.sendEmail !== false;
  const appUrl = (body.appUrl ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  log("provision_request", {
    sendEmail,
    appUrl,
    role: body.role ?? (body.studentId ? "student" : "staff"),
    batch: Array.isArray(body.students) ? body.students.length : 0,
    to: body.email?.trim().toLowerCase() ?? null,
  });
  if (!appUrl) {
    return json({ error: "appUrl is required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceKey);

  if (Array.isArray(body.students) && body.students.length > 0) {
    const batch = body.students.slice(0, 40);
    const results: ProvisionResult[] = [];
    for (const student of batch) {
      const email = student.email?.trim().toLowerCase();
      if (!email) {
        results.push({
          emailed: false,
          password: "",
          email: "",
          name: student.name,
          role: "student",
          studentId: student.id,
          error: "Missing email",
        });
        continue;
      }
      results.push(
        await provisionOne(
          admin,
          {
            role: "student",
            name: student.name,
            email,
            studentId: student.id,
            cohort: student.cohort,
          },
          appUrl,
          sendEmail,
        ),
      );
    }
    return json({ results });
  }

  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role: Role = body.role ?? (body.studentId ? "student" : "staff");
  if (!name || !email) {
    return json({ error: "name and email are required" }, 400);
  }
  if (role === "student" && !body.studentId) {
    return json({ error: "studentId is required" }, 400);
  }
  if (role === "staff" && body.teacherId === undefined && body.role !== "staff") {
    return json({ error: "teacherId, name, email, and appUrl are required" }, 400);
  }

  const result = await provisionOne(
    admin,
    {
      role,
      name,
      email,
      teacherId: body.teacherId?.trim() || undefined,
      studentId: body.studentId?.trim() || undefined,
      cohort: body.cohort,
    },
    appUrl,
    sendEmail,
  );
  if (result.error) {
    return json({ error: result.error }, 400);
  }
  return json({
    emailed: result.emailed,
    password: result.password,
    email: result.email,
    teacherId: result.teacherId,
    studentId: result.studentId,
    emailError: result.emailError,
  });
});
