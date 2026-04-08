import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 30_000;

const BASE_VOICE = `Você é o assistente de escrita da Inner AI. Reescreva textos seguindo rigorosamente as diretrizes da marca.

REGRAS DE VOZ PADRÃO:
- Tom inteligente e confiante — nunca arrogante
- Clareza acima de tudo — sem enrolação, sem floreio
- Moderno e direto — frases curtas e incisivas
- Persuasivo sem parecer forçado — mais autoridade que hype
- Evitar clichês de social media e marketing genérico
- Parecer uma marca premium, atual e útil

FORMATO DE RESPOSTA:
Retorne APENAS o texto reescrito, sem explicações, sem comentários, sem markdown.`;

const INTENT_PROMPTS: Record<string, string> = {
  clareza: "Foque em tornar o texto mais claro, fácil de entender e bem estruturado.",
  persuasao: "Foque em tornar o texto mais persuasivo e convincente.",
  engajamento: "Foque em tornar o texto mais envolvente e interativo.",
  autoridade: "Foque em posicionar a Inner AI como autoridade no assunto.",
  conversao: "Foque em otimizar o texto para conversão. CTA forte, benefícios claros.",
};

const INTENSITY_PROMPTS: Record<string, string> = {
  leve: "Faça ajustes sutis, mantendo a estrutura e a maior parte do texto original.",
  media: "Reescreva o texto melhorando significativamente a qualidade, mas mantendo a essência.",
  forte: "Reescreva o texto completamente se necessário. Priorize máxima qualidade e impacto.",
};

const VALID_INTENTS = new Set(Object.keys(INTENT_PROMPTS));
const VALID_INTENSITIES = new Set(Object.keys(INTENSITY_PROMPTS));

async function callGemini(systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada nos Supabase Secrets");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[improve-text] Gemini error ${res.status}: ${errBody.slice(0, 300)}`);
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta vazia da IA");
    return text;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") throw new Error("IA não respondeu dentro do tempo limite.");
    throw err;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit
    {
      const _rl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "improve_text", windowMinutes: 60, maxRequests: 30 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Input validation
    const body = await req.json();
    const { text, intent, intensity } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Texto é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (text.length > 10000) {
      return new Response(JSON.stringify({ error: "Texto muito longo (máx 10.000 caracteres)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeIntent = typeof intent === "string" && VALID_INTENTS.has(intent) ? intent : "clareza";
    const safeIntensity = typeof intensity === "string" && VALID_INTENSITIES.has(intensity) ? intensity : "media";

    // Fetch company brain — split into context (inspirational) and rules (mandatory)
    let brandContext = "";
    let hardRules = "";
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();
      if (cfg) {
        const icp = cfg.icp_json as Record<string, string> | null;
        const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
        const voice = cfg.voice_tone_json as Record<string, string> | null;
        const rules = cfg.rules_json as Record<string, string> | null;

        // Context: guides the AI's creative direction
        const ctx: string[] = [];
        if (icp?.persona) ctx.push(`Público-alvo: ${icp.persona}`);
        if (icp?.language_style) ctx.push(`Linguagem do público: ${icp.language_style}`);
        if (ed?.positioning) ctx.push(`Posicionamento: ${ed.positioning}`);
        if (ed?.pillars) ctx.push(`Pilares: ${ed.pillars}`);
        if (ed?.hook_patterns) ctx.push(`Padrões de gancho preferidos: ${ed.hook_patterns}`);
        if (ed?.copy_style) ctx.push(`Estilo de copy: ${ed.copy_style}`);
        if (ed?.creative_principles) ctx.push(`Princípios criativos: ${ed.creative_principles}`);
        if (voice?.voice) ctx.push(`Voz da marca: ${voice.voice}`);
        if (ctx.length > 0) brandContext = `\n\nCONTEXTO DA MARCA:\n${ctx.join("\n")}`;

        // Hard rules: the AI MUST follow these — violation = failure
        const rls: string[] = [];
        if (rules?.content_structure) rls.push(`ESTRUTURA OBRIGATÓRIA — o texto DEVE seguir esta sequência: ${rules.content_structure}`);
        if (rules?.always_include) rls.push(`ELEMENTOS OBRIGATÓRIOS — o texto DEVE conter: ${rules.always_include}`);
        if (rules?.never_include) rls.push(`PROIBIDO — o texto NÃO PODE conter: ${rules.never_include}`);
        if (voice?.forbidden_terms) rls.push(`TERMOS BANIDOS — NUNCA usar estas palavras/expressões: ${voice.forbidden_terms}`);
        if (voice?.preferred_terms) rls.push(`TERMOS PREFERIDOS — usar sempre que possível: ${voice.preferred_terms}`);
        if (voice?.cta_patterns) rls.push(`CTA — usar um destes padrões: ${voice.cta_patterns}`);
        if (rules?.content_rules) rls.push(`REGRAS ADICIONAIS: ${rules.content_rules}`);
        if (rls.length > 0) hardRules = `\n\n⚠️ REGRAS INVIOLÁVEIS (descumprir qualquer uma é erro grave):\n${rls.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;

        // Learnings from analyzed references
        const learn = cfg.learnings_json as Record<string, string[]> | null;
        if (learn) {
          const lp: string[] = [];
          if (learn.hooks?.length) lp.push(`Ganchos que funcionaram: ${learn.hooks.slice(-5).join(" | ")}`);
          if (learn.copy_patterns?.length) lp.push(`Estruturas de copy eficazes: ${learn.copy_patterns.slice(-5).join(" | ")}`);
          if (learn.ctas?.length) lp.push(`CTAs validados: ${learn.ctas.slice(-5).join(" | ")}`);
          if (lp.length > 0) brandContext += `\n\nAPRENDIZADOS DE REFERÊNCIAS ANALISADAS (inspire-se):\n${lp.join("\n")}`;
        }
      }

      // Knowledge base insights
      try {
        const { data: kbEntries } = await supabase.from("knowledge_entries")
          .select("extracted_insights").order("created_at", { ascending: false }).limit(5);
        if (kbEntries) {
          const allInsights = kbEntries.flatMap((e: any) => Array.isArray(e.extracted_insights) ? e.extracted_insights : []);
          if (allInsights.length > 0) {
            brandContext += `\n\nCONHECIMENTO DA BASE (aplique quando relevante):\n${allInsights.slice(0, 8).join("\n")}`;
          }
        }
      } catch { /* no knowledge yet */ }

      // Decision memories
      try {
        const { data: rej } = await supabase.from("brain_memories")
          .select("context").eq("memory_type", "rejection")
          .order("created_at", { ascending: false }).limit(3);
        if (rej?.length) {
          const reasons = rej.map((r: any) => r.context?.reason || r.context?.feedback).filter(Boolean);
          if (reasons.length > 0) brandContext += `\n\nREJEIÇÕES RECENTES (evitar):\n${reasons.join("\n")}`;
        }
      } catch { /* no memories */ }
    } catch { /* not configured yet */ }

    const intentGuide = INTENT_PROMPTS[safeIntent];
    const intensityGuide = INTENSITY_PROMPTS[safeIntensity];
    const systemPrompt = `${BASE_VOICE}${brandContext}${hardRules}\n\nINTENÇÃO: ${intentGuide}\nINTENSIDADE: ${intensityGuide}`;

    const improvedText = await callGemini(systemPrompt, `Reescreva este texto:\n\n${text}`);

    return new Response(JSON.stringify({ improved_text: improvedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("improve-text error:", e?.message ?? e);
    const status = e?.message?.includes("Limite") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
