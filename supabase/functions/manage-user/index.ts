import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
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
      return new Response(JSON.stringify({ error: "Apenas administradores podem gerenciar usuários." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, targetUserId } = body;

    if (!targetUserId || typeof targetUserId !== "string") {
      return new Response(JSON.stringify({ error: "targetUserId obrigatório." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent self-deletion/deactivation
    if (targetUserId === caller.id) {
      return new Response(JSON.stringify({ error: "Você não pode desativar ou excluir sua própria conta." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent deleting the last admin
    const { data: targetRoles } = await adminClient
      .from("user_roles").select("role").eq("user_id", targetUserId).eq("role", "admin");
    if (targetRoles?.length) {
      const { count } = await adminClient
        .from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return new Response(JSON.stringify({ error: "Não é possível remover o último administrador." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (action === "deactivate") {
      // Ban the user — they can't sign in anymore
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "876000h", // ~100 years
      });
      if (error) throw error;
      console.log(`[manage-user] Deactivated: ${targetUserId}`);
      return new Response(JSON.stringify({ ok: true, action: "deactivated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "activate") {
      // Unban the user
      const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
        ban_duration: "none",
      });
      if (error) throw error;
      console.log(`[manage-user] Activated: ${targetUserId}`);
      return new Response(JSON.stringify({ ok: true, action: "activated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "delete") {
      // Remove roles first
      await adminClient.from("user_roles").delete().eq("user_id", targetUserId);
      // Delete auth user (cascades to profiles via FK)
      const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
      if (error) throw error;
      console.log(`[manage-user] Deleted: ${targetUserId}`);
      return new Response(JSON.stringify({ ok: true, action: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Ação inválida. Use: deactivate, activate, delete." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (e: any) {
    console.error("[manage-user] error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e.message || "Erro ao gerenciar usuário" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
