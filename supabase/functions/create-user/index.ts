import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller }, error: callerErr } = await anonClient.auth.getUser();
    if (callerErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check caller has admin role
    const { data: callerRoles } = await adminClient
      .from("user_roles").select("role").eq("user_id", caller.id).eq("role", "admin");
    if (!callerRoles?.length) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse input
    const body = await req.json();
    const { email, name, password, role } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name || typeof name !== "string") {
      return new Response(JSON.stringify({ error: "Nome obrigatório." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalPassword = (typeof password === "string" && password.length >= 6) ? password : "123456";
    const validRoles = ["admin", "operator", "social_media", "designer"];
    const finalRole = validRoles.includes(role) ? role : "operator";

    // Create user via admin API — email_confirm: true skips verification
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: finalPassword,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createErr) {
      console.error("[create-user] Error:", createErr.message);
      if (createErr.message.includes("already been registered")) {
        return new Response(JSON.stringify({ error: "Este email já está cadastrado." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw createErr;
    }

    const userId = newUser.user.id;

    // Create profile
    await adminClient.from("profiles").upsert({
      id: userId,
      name,
      email: email.trim().toLowerCase(),
    });

    // Assign role
    await adminClient.from("user_roles").insert({
      user_id: userId,
      role: finalRole,
    });

    console.log(`[create-user] Created: ${email} with role ${finalRole}`);

    return new Response(JSON.stringify({
      user_id: userId,
      email: email.trim().toLowerCase(),
      name,
      role: finalRole,
      temporary_password: finalPassword,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[create-user] Unhandled:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao criar usuário" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
