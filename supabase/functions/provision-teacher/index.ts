import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PASSWORD_WORDS = [
  "acorn", "amber", "apple", "apron", "arrow", "bagel", "beach", "berry",
  "birch", "bloom", "brave", "breeze", "brook", "camel", "candy", "cedar",
  "cherry", "cider", "cloud", "clover", "coast", "cocoa", "coral", "creek",
  "daisy", "delta", "denim", "eagle", "earth", "echo", "ember", "fern",
  "field", "flame", "flora", "forest", "frost", "garden", "ginger", "glaze",
  "glow", "grape", "grove", "harbor", "hazel", "honey", "iris", "ivory",
  "jade", "jelly", "kiwi", "lake", "lemon", "lilac", "linen", "lotus",
  "maple", "meadow", "melon", "mint", "mist", "moss", "nest", "olive",
  "otter", "peach", "pearl", "pebble", "petal", "pine", "plum", "pond",
  "quilt", "rain", "raven", "ridge", "river", "robin", "ruby", "sage",
  "sail", "sandy", "seed", "shade", "shell", "silver", "snow", "spark",
  "spruce", "star", "stone", "sunny", "swift", "tide", "toast", "trail",
  "tulip", "valley", "velvet", "violet", "walnut", "wave", "wheat", "willow",
  "wind", "winter", "wool",
];

function randomInt(max: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return new DataView(bytes.buffer).getUint32(0, true) % max;
}

function generatePassword() {
  const first = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)]!;
  let second = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)]!;
  while (second === first) {
    second = PASSWORD_WORDS[randomInt(PASSWORD_WORDS.length)]!;
  }
  const number = 10 + randomInt(90);
  const cap = (word: string) => word[0]!.toUpperCase() + word.slice(1);
  return `${cap(first)}${cap(second)}${number}`;
}

function loginEmailHtml(input: {
  name: string;
  email: string;
  password: string;
  appUrl: string;
}) {
  const loginUrl = `${input.appUrl.replace(/\/$/, "")}/?view=login`;
  return `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1b1c1d;line-height:1.5">
      <p>Hi ${input.name},</p>
      <p>You can log in to Week View to cancel only your own classes. Students will see the cancellation on their schedule.</p>
      <p><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
      <p><strong>Email:</strong> ${input.email}<br/>
      <strong>Password:</strong> ${input.password}</p>
      <p>Stay signed in on your phone so you do not have to type this each time.</p>
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
    name?: string;
    email?: string;
    appUrl?: string;
    sendEmail?: boolean;
  };
  const teacherId = body.teacherId?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim().toLowerCase();
  const sendEmail = body.sendEmail !== false;
  const appUrl = (body.appUrl ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  if (!teacherId || !name || !email || !appUrl) {
    return json({ error: "teacherId, name, email, and appUrl are required" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(supabaseUrl, serviceKey);

  const password = generatePassword();
  let userId: string | null = null;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { teacher_id: teacherId, name },
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const existingId = await findUserIdByEmail(admin, email);
    if (!existingId) {
      return json({ error: created.error?.message ?? "Could not create user" }, 400);
    }
    const updated = await admin.auth.admin.updateUserById(existingId, {
      password,
      email,
      user_metadata: { teacher_id: teacherId, name },
    });
    if (updated.error || !updated.data.user) {
      return json({ error: updated.error?.message ?? "Could not update user" }, 400);
    }
    userId = updated.data.user.id;
  }

  const { error: upsertError } = await admin.from("teachers").upsert({
    id: teacherId,
    name,
    email,
    auth_user_id: userId,
  });
  if (upsertError) {
    return json({ error: upsertError.message }, 400);
  }

  let emailed = false;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM") ?? "UWCCR Schedules <onboarding@resend.dev>";
  if (sendEmail && resendKey) {
    const sent = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: "Your UWCCR schedule login",
        html: loginEmailHtml({ name, email, password, appUrl }),
      }),
    });
    emailed = sent.ok;
  }

  return json({ emailed, password, email, teacherId });
});
