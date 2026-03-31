import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Fetch editorial guidelines
    let editorialContext = "";
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: editorial } = await supabase.from("editorial_guidelines").select("*").limit(1).single();
      if (editorial) {
        const parts: string[] = [];
        if (editorial.brand_positioning) parts.push(`Posicionamento: ${editorial.brand_positioning}`);
        if (editorial.brand_voice) parts.push(`Tom de voz: ${editorial.brand_voice}`);
        if (editorial.visual_identity_guidelines) parts.push(`Identidade visual: ${editorial.visual_identity_guidelines}`);
        if (editorial.creative_principles) parts.push(`Princípios criativos: ${editorial.creative_principles}`);
        if (parts.length > 0) editorialContext = `\n\nDIRETRIZES DA MARCA:\n${parts.join("\n")}`;
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: BRIEF_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI gateway error:", response.status);
      return new Response(JSON.stringify({ error: "Erro no serviço de IA" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "";
    content = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let briefData;
    try {
      briefData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(JSON.stringify({ error: "A IA retornou um formato inválido. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ brief: briefData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-brief error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
