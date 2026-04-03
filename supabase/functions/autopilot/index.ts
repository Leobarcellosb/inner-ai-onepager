import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 50_000;

const SYSTEM_PROMPT = `Você é o motor de autopilot de uma plataforma de marketing. Recebe o cérebro da marca (ICP, editorial, voz, regras, aprendizados, conhecimento) e gera um ciclo completo de conteúdo.

Para cada conteúdo, gere:
1. Título atrativo (máx 80 chars)
2. Gancho (primeira frase que captura atenção)
3. Texto completo (copy pronta para publicação, seguindo regras de estrutura e tom)
4. CTA claro
5. Formato ideal (reels, carrossel, story, post_estatico)
6. Plataforma ideal (instagram, tiktok, youtube, linkedin)
7. Pilar editorial
8. Prioridade (low, medium, high, urgent)
9. Data e horário sugeridos (YYYY-MM-DD e HH:MM)

REGRAS:
- O texto deve estar PRONTO para publicação, não ser um rascunho
- Seguir rigorosamente a estrutura, tom e regras do cérebro
- Distribuir os conteúdos ao longo dos dias sem repetir pilar consecutivo
- Alternar formatos para variedade
- Horários devem ser otimizados por plataforma

FORMATO: JSON array com objetos:
{
  "title": "...",
  "hook": "...",
  "full_text": "...",
  "cta": "...",
  "format": "reels|carrossel|story|post_estatico",
  "platform": "instagram|tiktok|youtube|linkedin",
  "pillar": "...",
  "priority": "low|medium|high|urgent",
  "date": "YYYY-MM-DD",
  "time": "HH:MM"
}`;

function safeParseJson(raw: string): unknown[] {
  try { return JSON.parse(raw); } catch { /* */ }
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* */ }
  const match = stripped.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch { /* */ } }
  throw new Error("JSON inválido");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const count = Math.min(Math.max(parseInt(body.count) || 5, 1), 15);
    const startDate = typeof body.start_date === "string" ? body.start_date : new Date().toISOString().slice(0, 10);
    const autoApprove = body.auto_approve === true;
    const dryRun = body.dry_run === true;

    // Admin-only check
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: roleCheck } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").limit(1);
    if (!roleCheck || roleCheck.length === 0) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem usar o Autopilot." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit
    const rateLimitErr = await checkRateLimit(supabase, user.id, { action: "autopilot", windowMinutes: 60, maxRequests: 5 });
    if (rateLimitErr) {
      return new Response(JSON.stringify({ error: rateLimitErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load full brain
    const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();

    if (!cfg) {
      return new Response(JSON.stringify({ error: "Configure o Cérebro da Marca antes de usar o autopilot." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const icp = cfg.icp_json as Record<string, string> | null;
    const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
    const voice = cfg.voice_tone_json as Record<string, string> | null;
    const rules = cfg.rules_json as Record<string, string> | null;
    const learn = cfg.learnings_json as Record<string, string[]> | null;

    const brain: string[] = [];
    if (icp?.persona) brain.push(`ICP: ${icp.persona}`);
    if (icp?.pain_points) brain.push(`Dores: ${icp.pain_points}`);
    if (icp?.desires) brain.push(`Desejos: ${icp.desires}`);
    if (ed?.positioning) brain.push(`Posicionamento: ${ed.positioning}`);
    if (ed?.pillars) brain.push(`Pilares: ${ed.pillars}`);
    if (ed?.hook_patterns) brain.push(`Ganchos: ${ed.hook_patterns}`);
    if (ed?.copy_style) brain.push(`Estilo: ${ed.copy_style}`);
    if (voice?.voice) brain.push(`Voz: ${voice.voice}`);

    const rls: string[] = [];
    if (rules?.content_structure) rls.push(`Estrutura: ${rules.content_structure}`);
    if (rules?.always_include) rls.push(`DEVE conter: ${rules.always_include}`);
    if (rules?.never_include) rls.push(`NÃO PODE conter: ${rules.never_include}`);
    if (voice?.forbidden_terms) rls.push(`Banido: ${voice.forbidden_terms}`);
    if (voice?.cta_patterns) rls.push(`CTA: ${voice.cta_patterns}`);

    const lp: string[] = [];
    if (learn?.hooks?.length) lp.push(`Ganchos validados: ${learn.hooks.slice(-5).join(" | ")}`);
    if (learn?.copy_patterns?.length) lp.push(`Copy eficaz: ${learn.copy_patterns.slice(-3).join(" | ")}`);
    if (learn?.ctas?.length) lp.push(`CTAs que funcionam: ${learn.ctas.slice(-5).join(" | ")}`);

    // Knowledge
    let kbBlock = "";
    try {
      const { data: kb } = await supabase.from("knowledge_entries")
        .select("extracted_insights").order("created_at", { ascending: false }).limit(3);
      if (kb) {
        const insights = kb.flatMap((e: any) => Array.isArray(e.extracted_insights) ? e.extracted_insights : []);
        if (insights.length > 0) kbBlock = `\nConhecimento: ${insights.slice(0, 5).join(" | ")}`;
      }
    } catch { /* */ }

    // Existing scheduled to avoid conflicts
    const { data: existing } = await supabase.from("contents")
      .select("scheduled_date, platform").not("scheduled_date", "is", null).gte("scheduled_date", startDate);
    const conflicts = (existing ?? []).map(e => `${e.scheduled_date} (${e.platform})`).join(", ");

    let brainBlock = `\nMARCA:\n${brain.join("\n")}`;
    if (rls.length > 0) brainBlock += `\n\nREGRAS:\n${rls.join("\n")}`;
    if (lp.length > 0) brainBlock += `\n\nAPRENDIZADOS:\n${lp.join("\n")}`;
    if (kbBlock) brainBlock += kbBlock;
    if (conflicts) brainBlock += `\n\nJÁ AGENDADOS (evitar): ${conflicts}`;

    const userPrompt = `Gere ${count} conteúdos COMPLETOS prontos para publicação a partir de ${startDate}.${brainBlock}\n\nRetorne JSON array.`;

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
          }),
        },
      );
    } catch (err: any) {
      clearTimeout(timeout);
      if (err?.name === "AbortError") throw new Error("IA não respondeu a tempo.");
      throw err;
    }
    clearTimeout(timeout);

    if (!res.ok) {
      if (res.status === 429) throw new Error("Limite de requisições.");
      throw new Error(`Gemini error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Resposta vazia da IA");

    const items = safeParseJson(rawText) as Record<string, string>[];

    // Dry run: return items for review without inserting
    if (dryRun) {
      return new Response(JSON.stringify({
        created: 0,
        items,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert to DB
    const validPlatforms = new Set(["instagram", "tiktok", "youtube", "linkedin", "whatsapp", "multiuso"]);
    const validFormats = new Set(["reels", "carrossel", "story", "post_estatico", "anuncio", "email", "roteiro"]);
    const validPriorities = new Set(["low", "medium", "high", "urgent"]);

    const records = items.map(item => ({
      title: (item.title || "Sem título").slice(0, 200),
      theme: item.pillar || "",
      platform: validPlatforms.has(item.platform) ? item.platform : "instagram",
      format: validFormats.has(item.format) ? item.format : "post_estatico",
      objective: "",
      raw_text: item.full_text || item.hook || "",
      cta: item.cta || "",
      created_by: user.id,
      status: autoApprove ? "copy_approved" as const : "writing" as const,
      priority: validPriorities.has(item.priority) ? item.priority : "medium",
      content_type: item.format || "post",
      scheduled_date: item.date || startDate,
      scheduled_time: item.time ? `${item.time}:00` : "10:00:00",
      source_origin: "autopilot",
      copy_auto_approved: autoApprove,
      copy_auto_approved_by: autoApprove ? user.id : null,
      copy_auto_approved_at: autoApprove ? new Date().toISOString() : null,
    }));

    const { error: insertErr } = await supabase.from("contents").insert(records);
    if (insertErr) throw insertErr;

    return new Response(JSON.stringify({
      created: records.length,
      status: autoApprove ? "copy_approved" : "writing",
      items: items.map(i => ({ title: i.title, date: i.date, platform: i.platform, format: i.format })),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[autopilot] error:", e?.message ?? e);
    return new Response(JSON.stringify({ error: e?.message || "Erro no autopilot" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
