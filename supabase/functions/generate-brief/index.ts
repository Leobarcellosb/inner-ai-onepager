import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_TIMEOUT_MS = 40_000;

const BRIEF_SYSTEM_PROMPT = `Você é o assistente criativo da Inner AI. Sua função é gerar briefs criativos altamente práticos e acionáveis para designers.

REGRAS:
- Cada campo deve ser direto e útil — sem enrolação
- Linguagem clara, moderna e profissional
- O designer precisa entender exatamente o que fazer ao ler o brief
- Direção visual deve ser específica (cores, estilos, referências concretas)
- Estrutura de slides/cenas deve ser detalhada e sequencial
- CTA deve ser claro e orientado a conversão
- Tom da Inner AI: confiante, inteligente, premium, sem clichês

FORMATO DE RESPOSTA:
Responda APENAS com um JSON válido (sem markdown, sem código, sem explicações) com exatamente estes campos:
{
  "creative_angle": "ângulo criativo da peça",
  "campaign_objective": "objetivo claro da campanha/peça",
  "target_audience": "público-alvo detalhado",
  "key_message": "mensagem central que o designer deve comunicar",
  "visual_direction": "direção visual específica (paleta, estilo, mood)",
  "visual_references": "referências visuais concretas",
  "mandatory_elements": "elementos que DEVEM estar na peça",
  "suggested_slides_or_scenes": "estrutura detalhada slide a slide ou cena a cena",
  "copy_summary": "resumo da copy para o designer usar como referência",
  "cta": "call to action principal"
}`;

function safeParseJson(raw: string): Record<string, string> {
  // Try direct parse first
  try { return JSON.parse(raw); } catch { /* continue */ }
  // Strip markdown fences
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(stripped); } catch { /* continue */ }
  // Try to extract JSON object from text
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* give up */ }
  }
  throw new Error(`JSON inválido retornado pela IA: ${raw.slice(0, 300)}`);
}

async function callGeminiJson(systemPrompt: string, userPrompt: string): Promise<Record<string, string>> {
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
          generationConfig: {
            temperature: 0.8,
            responseMimeType: "application/json",
          },
        }),
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(`[generate-brief] Gemini error ${res.status}: ${errBody.slice(0, 300)}`);
      if (res.status === 429) throw new Error("Limite de requisições atingido.");
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Resposta vazia da IA");
    return safeParseJson(text);
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
      const _rlErr = await checkRateLimit(_rl, user.id, { action: "generate_brief", windowMinutes: 60, maxRequests: 20 });
      if (_rlErr) return new Response(JSON.stringify({ error: _rlErr }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    // Input validation
    const body = await req.json();
    const { theme, objective, platform, format, targetAudience, rawText, notes, referenceAnalysis } = body;

    if (!theme || typeof theme !== "string" || theme.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Tema é obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const safeTheme = theme.slice(0, 500);
    const safeObjective = typeof objective === "string" ? objective.slice(0, 500) : "";
    const safePlatform = typeof platform === "string" ? platform.slice(0, 100) : "";
    const safeFormat = typeof format === "string" ? format.slice(0, 100) : "";
    const safeAudience = typeof targetAudience === "string" ? targetAudience.slice(0, 500) : "";
    const safeRawText = typeof rawText === "string" ? rawText.slice(0, 5000) : "";
    const safeNotes = typeof notes === "string" ? notes.slice(0, 2000) : "";

    // Fetch company brain — context + hard rules
    let editorialContext = "";
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: cfg } = await supabase.from("company_config").select("*").limit(1).single();
      if (cfg) {
        const icp = cfg.icp_json as Record<string, string> | null;
        const ed = cfg.editorial_guidelines_json as Record<string, string> | null;
        const voice = cfg.voice_tone_json as Record<string, string> | null;
        const rules = cfg.rules_json as Record<string, string> | null;

        const ctx: string[] = [];
        if (icp?.persona) ctx.push(`Público-alvo: ${icp.persona}`);
        if (icp?.pain_points) ctx.push(`Dores: ${icp.pain_points}`);
        if (icp?.desires) ctx.push(`Desejos: ${icp.desires}`);
        if (ed?.positioning) ctx.push(`Posicionamento: ${ed.positioning}`);
        if (ed?.pillars) ctx.push(`Pilares: ${ed.pillars}`);
        if (ed?.hook_patterns) ctx.push(`Ganchos preferidos: ${ed.hook_patterns}`);
        if (ed?.copy_style) ctx.push(`Estilo de copy: ${ed.copy_style}`);
        if (ed?.visual_patterns) ctx.push(`Padrões visuais: ${ed.visual_patterns}`);
        if (ed?.visual_identity) ctx.push(`Identidade visual: ${ed.visual_identity}`);
        if (ed?.creative_principles) ctx.push(`Princípios: ${ed.creative_principles}`);
        if (voice?.voice) ctx.push(`Voz: ${voice.voice}`);

        const rls: string[] = [];
        if (rules?.content_structure) rls.push(`ESTRUTURA — o brief DEVE usar esta sequência para o conteúdo: ${rules.content_structure}`);
        if (rules?.always_include) rls.push(`OBRIGATÓRIO — o brief DEVE prever estes elementos: ${rules.always_include}`);
        if (rules?.never_include) rls.push(`PROIBIDO — o brief NÃO PODE incluir: ${rules.never_include}`);
        if (voice?.forbidden_terms) rls.push(`TERMOS BANIDOS: ${voice.forbidden_terms}`);
        if (voice?.cta_patterns) rls.push(`CTA — usar um destes: ${voice.cta_patterns}`);
        if (rules?.design_rules) rls.push(`REGRAS VISUAIS: ${rules.design_rules}`);

        // Learnings from analyzed references
        const learn = cfg.learnings_json as Record<string, string[]> | null;
        const lp: string[] = [];
        if (learn?.hooks?.length) lp.push(`Ganchos que funcionaram: ${learn.hooks.slice(-5).join(" | ")}`);
        if (learn?.copy_patterns?.length) lp.push(`Estruturas de copy eficazes: ${learn.copy_patterns.slice(-5).join(" | ")}`);
        if (learn?.visual_patterns?.length) lp.push(`Padrões visuais validados: ${learn.visual_patterns.slice(-5).join(" | ")}`);
        if (learn?.ctas?.length) lp.push(`CTAs validados: ${learn.ctas.slice(-5).join(" | ")}`);

        let block = "";
        if (ctx.length > 0) block += `\nCONTEXTO DA MARCA:\n${ctx.join("\n")}`;
        if (lp.length > 0) block += `\n\nAPRENDIZADOS DE REFERÊNCIAS (inspire-se):\n${lp.join("\n")}`;
        if (rls.length > 0) block += `\n\n⚠️ REGRAS INVIOLÁVEIS:\n${rls.map((r, i) => `${i + 1}. ${r}`).join("\n")}`;
        // Knowledge base
        try {
          const { data: kbEntries } = await supabase.from("knowledge_entries")
            .select("extracted_insights").order("created_at", { ascending: false }).limit(5);
          if (kbEntries) {
            const insights = kbEntries.flatMap((e: any) => Array.isArray(e.extracted_insights) ? e.extracted_insights : []);
            if (insights.length > 0) block += `\n\nCONHECIMENTO ADICIONAL:\n${insights.slice(0, 8).join("\n")}`;
          }
        } catch { /* no knowledge yet */ }

        // Decision memories
        try {
          const { data: rej } = await supabase.from("brain_memories")
            .select("context").eq("memory_type", "rejection")
            .order("created_at", { ascending: false }).limit(3);
          if (rej?.length) {
            const reasons = rej.map((r: any) => r.context?.reason).filter(Boolean);
            if (reasons.length > 0) block += `\n\nREJEIÇÕES (evitar):\n${reasons.join("\n")}`;
          }
        } catch { /* no memories */ }

        if (block) editorialContext = block;
      }
    } catch { /* not configured yet */ }

    // Build reference analysis context
    let referenceContext = "";
    if (referenceAnalysis && typeof referenceAnalysis === "object") {
      const ra = referenceAnalysis;
      const parts: string[] = [];
      if (typeof ra.analysis_summary === "string") parts.push(`Resumo: ${ra.analysis_summary.slice(0, 1000)}`);
      if (typeof ra.copy_structure === "string") parts.push(`Estrutura de copy: ${ra.copy_structure.slice(0, 1000)}`);
      if (typeof ra.visual_hierarchy === "string") parts.push(`Hierarquia visual: ${ra.visual_hierarchy.slice(0, 500)}`);
      if (typeof ra.visual_composition === "string") parts.push(`Composição visual: ${ra.visual_composition.slice(0, 500)}`);
      if (typeof ra.observed_color_pattern === "string") parts.push(`Cores: ${ra.observed_color_pattern.slice(0, 500)}`);
      if (typeof ra.persuasion_mechanisms === "string") parts.push(`Persuasão: ${ra.persuasion_mechanisms.slice(0, 500)}`);
      if (typeof ra.adaptation_for_inner_ai === "string") parts.push(`Adaptação: ${ra.adaptation_for_inner_ai.slice(0, 1000)}`);
      if (typeof ra.inspired_generation_prompt === "string") parts.push(`Prompt inspirado: ${ra.inspired_generation_prompt.slice(0, 1000)}`);
      if (parts.length > 0) referenceContext = `\n\nREFERÊNCIA ANALISADA (inspire-se, NÃO copie):\n${parts.join("\n")}`;
    }

    const userPrompt = `Gere um brief criativo completo:

TEMA: ${safeTheme}
OBJETIVO: ${safeObjective || "Não especificado"}
PLATAFORMA: ${safePlatform || "Não especificada"}
FORMATO: ${safeFormat || "Não especificado"}
PÚBLICO-ALVO: ${safeAudience || "Não especificado"}
${safeRawText ? `TEXTO BASE:\n${safeRawText}` : ""}
${safeNotes ? `OBSERVAÇÕES:\n${safeNotes}` : ""}
${editorialContext}
${referenceContext}

Gere o brief completo em JSON.`;

    const briefData = await callGeminiJson(BRIEF_SYSTEM_PROMPT, userPrompt);

    return new Response(JSON.stringify({ brief: briefData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-brief error:", e?.message ?? e);
    const status = e?.message?.includes("Limite") ? 429 : 500;
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
